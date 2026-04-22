import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Divider,
  Form,
  Paper,
  defineWidget,
  runScript,
  useCloseWidget,
  useOAuth,
} from "@eney/api";
import type { OAuthConfig } from "@eney/api";

// ─── OAuth configs ─────────────────────────────────────────────────────────────
const twitterOAuth: OAuthConfig = {
  clientId: "cmZMQVRwS1p4OHVYeU5yZVI2bzc6MTpjaQ",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  scopes: ["tweet.write", "tweet.read", "users.read", "offline.access"],
};
const threadsOAuth: OAuthConfig = {
  clientId: "1329970789038817",
  authorizeUrl: "https://threads.net/oauth/authorize",
  tokenUrl: "https://graph.threads.net/oauth/access_token",
  scopes: ["threads_basic", "threads_content_publish"],
};
const linkedinOAuth: OAuthConfig = {
  clientId: "78f7izrwragjwl",
  authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  scopes: ["w_member_social", "openid", "profile"],
};
const instagramOAuth: OAuthConfig = {
  clientId: "INSTAGRAM_CLIENT_ID",
  authorizeUrl: "https://www.instagram.com/oauth/authorize",
  tokenUrl: "https://api.instagram.com/oauth/access_token",
  scopes: ["instagram_basic", "instagram_content_publish"],
};

// Add platform keys here once their client IDs are configured
const CONFIGURED_PLATFORMS = new Set(["twitter", "threads", "linkedin"]);

// ─── Twitter posting ───────────────────────────────────────────────────────────
function parseThread(text: string): string[] {
  return text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);
}

async function postToTwitter(accessToken: string, text: string): Promise<void> {
  let prevId: string | null = null;
  for (const tweet of parseThread(text)) {
    const body: Record<string, unknown> = { text: tweet };
    if (prevId) body.reply = { in_reply_to_tweet_id: prevId };
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail ?? (err as any).errors?.[0]?.message ?? `Error ${res.status}`);
    }
    prevId = ((await res.json()) as any).data?.id ?? null;
  }
}

// ─── Threads posting ──────────────────────────────────────────────────────────
async function postToThreads(accessToken: string, text: string): Promise<void> {
  const meRes = await fetch("https://graph.threads.net/v1.0/me?fields=id", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) throw new Error(`Threads auth error ${meRes.status}`);
  const { id: userId } = (await meRes.json()) as { id: string };

  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `Threads create error ${createRes.status}`);
  }
  const { id: creationId } = (await createRes.json()) as { id: string };

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId }),
  });
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error((err as any).error?.message ?? `Threads publish error ${publishRes.status}`);
  }
}

// ─── LinkedIn posting ─────────────────────────────────────────────────────────
async function postToLinkedIn(accessToken: string, text: string): Promise<void> {
  // Get the member's URN
  const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) throw new Error(`LinkedIn auth error ${meRes.status}`);
  const me = (await meRes.json()) as { sub: string };
  const authorUrn = `urn:li:person:${me.sub}`;

  // Create the post
  const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!postRes.ok) {
    const err = await postRes.json().catch(() => ({}));
    throw new Error((err as any).message ?? `LinkedIn post error ${postRes.status}`);
  }
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  originalContent: z.string().optional().describe("The original long-form content to repurpose."),
  twitterThread: z.string().optional().describe(
    "Repurposed Twitter/X thread. Separate tweets with a blank line. Max 280 chars each."
  ),
  threadsPost: z.string().optional().describe(
    "Repurposed Threads post. Conversational tone, up to 500 characters."
  ),
  linkedinPost: z.string().optional().describe(
    "Repurposed LinkedIn post. Professional tone, strong hook, CTA at end. Max 3000 characters."
  ),
  instagramCaption: z.string().optional().describe(
    "Repurposed Instagram caption. Visual-first tone with 3–5 hashtags. Max 2200 characters."
  ),
  defaultPlatform: z.enum(["twitter", "threads", "linkedin", "instagram"]).optional().describe(
    "Which platform tab to show first when the widget opens. Use this when reopening after a regenerate to return the user to the platform they were on."
  ),
});

type Props = z.infer<typeof schema>;
type PlatformKey = "twitter" | "threads" | "linkedin" | "instagram";
type PostStatus = "idle" | "posting" | "success" | "error";

interface Platform {
  key: PlatformKey;
  label: string;
  propKey: keyof Omit<Props, "originalContent">;
}

const ALL_PLATFORMS: Platform[] = [
  { key: "twitter",   label: "Twitter / X",  propKey: "twitterThread"    },
  { key: "threads",   label: "Threads",       propKey: "threadsPost"      },
  { key: "linkedin",  label: "LinkedIn",      propKey: "linkedinPost"     },
  { key: "instagram", label: "Instagram",     propKey: "instagramCaption" },
];

const INSTRUCTIONS = `## Content Repurposer

Turn any long-form content into platform-ready posts.

**How to use:**

> *"Repurpose this blog post for Twitter, LinkedIn, and Instagram"*

Paste your article or notes and I'll generate tailored versions for each platform with copy and post options.

**Platforms:** Twitter/X · Threads · LinkedIn · Instagram`;

const OAUTH_CONFIGS: Record<PlatformKey, OAuthConfig> = {
  twitter:   twitterOAuth,
  threads:   threadsOAuth,
  linkedin:  linkedinOAuth,
  instagram: instagramOAuth,
};

// ─── Component ────────────────────────────────────────────────────────────────
function RepurposeContent(props: Props) {
  const closeWidget = useCloseWidget();

  // Always show all 4 platforms regardless of what was generated
  const availablePlatforms = ALL_PLATFORMS;
  const hasResults = !!(props.twitterThread || props.threadsPost || props.linkedinPost || props.instagramCaption);

  // Default to the first platform that actually has content (so we never land on an empty tab)
  const firstWithContent = ALL_PLATFORMS.find((p) => !!String(props[p.propKey] ?? "").trim())?.key ?? "twitter";
  // State before useOAuth so activePlatformKey is stable when hook runs
  const [activePlatformKey, setActivePlatformKey] = useState<PlatformKey>(
    (props.defaultPlatform as PlatformKey | undefined) ?? firstWithContent
  );
  const [postStatus, setPostStatus]       = useState<PostStatus>("idle");
  const [postError, setPostError]         = useState<string>("");
  // Store access tokens per platform as they are connected
  const [platformTokens, setPlatformTokens] = useState<Partial<Record<PlatformKey, string>>>({});

  // On mount: load Threads + LinkedIn tokens from ~/.eney-repurposer.json
  useEffect(() => {
    runScript(`do shell script "cat ~/.eney-repurposer.json 2>/dev/null || echo '{}'"`).then((raw) => {
      try {
        const cfg = JSON.parse(raw.trim()) as Partial<Record<string, string>>;
        setPlatformTokens((prev) => ({
          ...prev,
          ...(cfg.threads  ? { threads:  cfg.threads  } : {}),
          ...(cfg.linkedin ? { linkedin: cfg.linkedin } : {}),
        }));
      } catch {}
    }).catch(() => {});
  }, []);

  // Single OAuth hook — swaps config as platform changes (used for Twitter)
  const auth = useOAuth(OAUTH_CONFIGS[activePlatformKey]);

  const activePlatform = ALL_PLATFORMS.find((p) => p.key === activePlatformKey) ?? ALL_PLATFORMS[0];
  const activeContent  = activePlatform ? String(props[activePlatform.propKey] ?? "").trim() : "";

  const isConfigured  = activePlatform ? CONFIGURED_PLATFORMS.has(activePlatform.key) : false;
  const platformToken = activePlatform ? (platformTokens[activePlatform.key] ?? null) : null;
  const isConnected   = !!platformToken;

  const postButtonTitle = !isConfigured
    ? `${activePlatform?.label ?? ""} coming soon`
    : !isConnected
    ? auth.status === "pending" ? "Connecting..." : `Connect ${activePlatform?.label ?? ""}`
    : postStatus === "posting" ? "Posting..."
    : postStatus === "success" ? "Posted!"
    : `Post to ${activePlatform?.label ?? ""}`;

  const postButtonLoading  = isConfigured && auth.status === "pending" || postStatus === "posting";
  const postButtonDisabled = !isConfigured || postStatus === "posting" || postStatus === "success";

  async function handlePostButton() {
    if (!isConfigured || !activePlatform) return;
    if (!isConnected) {
      auth.authorize()
        .then((tokens) => {
          if (activePlatform) {
            setPlatformTokens((prev) => ({ ...prev, [activePlatform.key]: tokens.accessToken }));
          }
        })
        .catch(() => {});
      return;
    }
    if (!platformToken) return;
    setPostStatus("posting");
    setPostError("");
    try {
      if (activePlatform.key === "twitter") await postToTwitter(platformToken, activeContent);
      else if (activePlatform.key === "threads") await postToThreads(platformToken, activeContent);
      else if (activePlatform.key === "linkedin") await postToLinkedIn(platformToken, activeContent);
      setPostStatus("success");
    } catch (err) {
      setPostError(err instanceof Error ? err.message : String(err));
      setPostStatus("error");
    }
  }

  // ── Instructions screen ──
  if (!hasResults) {
    return (
      <Form
        header={<CardHeader title="Content Repurposer" iconBundleId="com.apple.TextEdit" />}
        actions={
          <ActionPanel>
            <Action title="Close" onAction={() => closeWidget("Closed.")} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper markdown={INSTRUCTIONS} />
      </Form>
    );
  }

  const statusLine = postStatus === "success"
    ? `✅ **Posted to ${activePlatform?.label ?? ""}!**`
    : postStatus === "error"
    ? `❌ **Failed:** ${postError}`
    : !isConfigured
    ? `ℹ️ Posting to ${activePlatform?.label ?? ""} coming soon.`
    : !isConnected
    ? `ℹ️ Connect your ${activePlatform?.label ?? ""} account to post directly.`
    : "";

  const originalPreview = props.originalContent
    ? `**Source:** ${props.originalContent.slice(0, 120).trim()}${props.originalContent.length > 120 ? "…" : ""}`
    : null;

  // ── Results screen ──
  // ActionPanel always: Divider → Attach → Remove → Regenerate → Copy → Post (6 children, stable)
  return (
    <Form
      header={<CardHeader title="Content Repurposer" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel>
          <Divider />
          <Action
            title={`Regenerate for ${activePlatform?.label ?? "platform"}`}
            onAction={() => {
              const preserved = ALL_PLATFORMS
                .filter((p) => p.key !== activePlatformKey)
                .map((p) => {
                  const content = String(props[p.propKey] ?? "").trim();
                  return `${p.propKey}: """${content}"""`;
                })
                .join("\n\n");
              closeWidget(
                `Regenerate ONLY the ${activePlatform?.label ?? "current platform"} version (field: ${activePlatform?.propKey ?? ""}). ` +
                `Make it noticeably different from before. ` +
                `For ALL other platforms, copy the text below EXACTLY — do not change a single word:\n\n${preserved}\n\n` +
                `Set defaultPlatform to "${activePlatformKey}" when calling repurpose-content.`
              );
            }}
            style="secondary"
          />
          <Action.CopyToClipboard
            content={activeContent}
            title={`Copy for ${activePlatform?.label ?? "platform"}`}
            style="secondary"
          />
          <Action
            title={postButtonTitle}
            onAction={handlePostButton}
            style="primary"
            isLoading={postButtonLoading}
            isDisabled={postButtonDisabled}
          />
        </ActionPanel>
      }
    >
      {originalPreview && <Paper markdown={originalPreview} />}

      <Form.Dropdown
        name="platform"
        label="Platform"
        value={activePlatformKey}
        onChange={(v) => {
          setActivePlatformKey(v as PlatformKey);
          setPostStatus("idle");
          setPostError("");
        }}
      >
        <Form.Dropdown.Item value="twitter"   title="Twitter / X" />
        <Form.Dropdown.Item value="threads"   title="Threads"     />
        <Form.Dropdown.Item value="linkedin"  title="LinkedIn"    />
        <Form.Dropdown.Item value="instagram" title="Instagram"   />
      </Form.Dropdown>

      {activeContent
        ? <Paper markdown={activeContent} isScrollable />
        : <Paper markdown={`*No content generated for ${activePlatform?.label ?? "this platform"} — ask me to repurpose for all platforms.*`} />
      }

      {statusLine !== "" && <Paper markdown={statusLine} />}
    </Form>
  );
}

const RepurposeContentWidget = defineWidget({
  name: "repurpose-content",
  description:
    "Display repurposed social media content for Twitter/X, Threads, LinkedIn, and Instagram. " +
    "CRITICAL WORKFLOW — follow this order exactly: " +
    "STEP 1: Write the repurposed text for ALL FOUR platforms in your thinking before calling this tool. " +
    "STEP 2: Call this tool with ALL FOUR fields populated: twitterThread, threadsPost, linkedinPost, instagramCaption. " +
    "MANDATORY RULES — violating any of these will break the widget: " +
    "(A) twitterThread must NEVER be empty or undefined. " +
    "(B) threadsPost must NEVER be empty or undefined — this field is frequently skipped by mistake; do NOT skip it. " +
    "(C) linkedinPost must NEVER be empty or undefined. " +
    "(D) instagramCaption must NEVER be empty or undefined. " +
    "Do NOT call this tool before all four fields are written. Do NOT omit any field. Do NOT pass undefined or empty string for any field. " +
    "When reopening after a regenerate request: set defaultPlatform to the platform key the user was on (twitter | threads | linkedin | instagram), " +
    "and copy the preserved text blocks from the regenerate message EXACTLY into the matching fields — do not paraphrase or shorten them.",
  schema,
  component: RepurposeContent,
});

export default RepurposeContentWidget;
