import { useState, useEffect } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Divider,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
  useOAuth,
} from "@eney/api";
import type { OAuthConfig } from "@eney/api";

const twitterOAuth: OAuthConfig = {
  clientId: "cmZMQVRwS1p4OHVYeU5yZVI2bzc6MTpjaQ",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  scopes: ["tweet.write", "tweet.read", "users.read", "offline.access"],
};

function parseThread(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

async function postThread(accessToken: string, threadText: string): Promise<void> {
  const tweets = parseThread(threadText);
  let previousTweetId: string | null = null;

  for (const tweetText of tweets) {
    const body: Record<string, unknown> = { text: tweetText };
    if (previousTweetId) {
      body.reply = { in_reply_to_tweet_id: previousTweetId };
    }

    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message =
        (err as any).detail ??
        (err as any).errors?.[0]?.message ??
        `Twitter API error ${response.status}`;
      throw new Error(message);
    }

    const data = await response.json();
    previousTweetId = (data as any).data?.id ?? null;
  }
}

const schema = z.object({
  content: z
    .string()
    .optional()
    .describe(
      "The Twitter/X thread content to post. Separate individual tweets with a blank line. " +
        "Each tweet must be max 280 characters."
    ),
});

type Props = z.infer<typeof schema>;
type PostStatus = "idle" | "posting" | "success" | "error";

function PostToTwitter(props: Props) {
  const closeWidget = useCloseWidget();
  const { status: authStatus, tokens, authorize } = useOAuth(twitterOAuth);

  const [content, setContent] = useState(props.content ?? "");
  const [postStatus, setPostStatus] = useState<PostStatus>("idle");
  const [postError, setPostError] = useState("");

  // Auto-attempt sign-in with cached tokens on open
  useEffect(() => {
    authorize().catch(() => {});
  }, []);

  async function handlePost() {
    if (!tokens?.accessToken || !content.trim()) return;
    setPostStatus("posting");
    setPostError("");
    try {
      await postThread(tokens.accessToken, content);
      setPostStatus("success");
    } catch (err) {
      setPostError(err instanceof Error ? err.message : String(err));
      setPostStatus("error");
    }
  }

  const header = <CardHeader title="Post to X" iconBundleId="com.apple.Notes" />;

  // ── Not yet authenticated ──
  if (authStatus !== "ready" || !tokens) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Divider />
            <Action
              title={authStatus === "pending" ? "Connecting..." : "Connect X account"}
              onAction={authorize}
              style="primary"
              isLoading={authStatus === "pending"}
            />
          </ActionPanel>
        }
      >
        <Paper markdown="Sign in to your X account to post directly from Eney." />
        {authStatus === "error" && (
          <Paper markdown="❌ Sign-in failed. Please try again." />
        )}
      </Form>
    );
  }

  // ── Posted successfully ──
  if (postStatus === "success") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Divider />
            <Action title="Done" onAction={() => closeWidget("Posted to X.")} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown="✅ **Posted to X successfully!**" />
      </Form>
    );
  }

  // ── Ready to post ──
  return (
    <Form
      header={header}
      size="medium"
      actions={
        <ActionPanel>
          <Divider />
          <Action
            title={postStatus === "posting" ? "Posting..." : "Post to X"}
            onAction={handlePost}
            style="primary"
            isLoading={postStatus === "posting"}
            isDisabled={postStatus === "posting" || !content.trim()}
          />
        </ActionPanel>
      }
    >
      {postStatus === "error" && (
        <Paper markdown={`❌ **Failed:** ${postError}`} />
      )}
      <Form.RichTextEditor value={content} onChange={setContent} />
    </Form>
  );
}

const PostToTwitterWidget = defineWidget({
  name: "post-to-twitter",
  description:
    "Post a tweet or thread directly to Twitter/X. " +
    "Pass the thread content as the 'content' parameter — separate individual tweets with a blank line. " +
    "Opens a sign-in flow if the user has not connected their X account yet.",
  schema,
  component: PostToTwitter,
});

export default PostToTwitterWidget;
