import { useEffect, useState } from "react";
import { spawn } from "node:child_process";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
} from "@eney/api";
import { loadConfig, saveConfig } from "../helpers/config.js";
import { uploadToYouTube, type Privacy } from "../helpers/youtube.js";
import { authorizeGoogle, refreshGoogleToken, type Tokens } from "../helpers/google-oauth.js";
import type { CaptionDraft } from "../helpers/caption.js";

const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

interface YouTubeUploadProps {
  videoPath: string;
  caption: CaptionDraft | null;
  onBack: () => void;
  onDone: () => void;
}

export function YouTubeUpload(props: YouTubeUploadProps) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");

  const [authStatus, setAuthStatus] = useState<"idle" | "pending" | "error">("idle");
  const [authError, setAuthError] = useState("");

  const [title, setTitle] = useState(props.caption?.title ?? "");
  const [description, setDescription] = useState(props.caption?.description ?? "");
  const [tagsInput, setTagsInput] = useState(
    (props.caption?.hashtags ?? []).map((h) => h.replace(/^#/, "")).join(", "),
  );
  const [privacy, setPrivacy] = useState<Privacy>("private");

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [result, setResult] = useState<{ videoId: string; url: string } | null>(null);

  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg.youtubeClientId) setClientId(cfg.youtubeClientId);
      if (cfg.youtubeClientSecret) setClientSecret(cfg.youtubeClientSecret);
      if (cfg.youtubeTokens) setTokens(cfg.youtubeTokens);
      setIsLoaded(true);
    });
  }, []);

  async function onSaveCredentials() {
    const id = sanitizeClientId(clientIdInput);
    const secret = clientSecretInput.trim();
    if (!id) return;
    await saveConfig({ youtubeClientId: id, youtubeClientSecret: secret || undefined });
    setClientId(id);
    setClientSecret(secret || null);
  }

  async function onResetCredentials() {
    await saveConfig({
      youtubeClientId: undefined,
      youtubeClientSecret: undefined,
      youtubeTokens: undefined,
    });
    setClientId(null);
    setClientSecret(null);
    setTokens(null);
    setClientIdInput("");
    setClientSecretInput("");
    setAuthError("");
  }

  async function onSignIn() {
    if (!clientId) return;
    setAuthStatus("pending");
    setAuthError("");
    try {
      const t = await authorizeGoogle(clientId, clientSecret, YOUTUBE_SCOPES);
      await saveConfig({ youtubeTokens: t });
      setTokens(t);
      setAuthStatus("idle");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
      setAuthStatus("error");
    }
  }

  async function ensureFreshToken(): Promise<string> {
    if (!tokens || !clientId) throw new Error("Not signed in.");
    if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;
    if (!tokens.refreshToken) throw new Error("Access token expired and no refresh token available. Please sign in again.");
    const refreshed = await refreshGoogleToken(clientId, clientSecret, tokens.refreshToken);
    await saveConfig({ youtubeTokens: refreshed });
    setTokens(refreshed);
    return refreshed.accessToken;
  }

  async function onUpload() {
    setUploadError("");
    setIsUploading(true);
    setProgress(0);
    try {
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter((t) => t.length > 0);
      const metadata = { title: title.trim(), description: description.trim(), tags, privacy };

      let accessToken = await ensureFreshToken();
      try {
        const res = await uploadToYouTube(props.videoPath, accessToken, metadata, setProgress);
        setResult(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("401") && tokens?.refreshToken && clientId) {
          const refreshed = await refreshGoogleToken(clientId, clientSecret, tokens.refreshToken);
          await saveConfig({ youtubeTokens: refreshed });
          setTokens(refreshed);
          accessToken = refreshed.accessToken;
          const res = await uploadToYouTube(props.videoPath, accessToken, metadata, setProgress);
          setResult(res);
        } else {
          throw e;
        }
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(false);
    }
  }

  if (!isLoaded) {
    return simpleScreen("Upload to YouTube", "_Loading…_");
  }

  if (!clientId) {
    return (
      <Form
        header={<CardHeader title="YouTube Setup" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Back" onAction={props.onBack} style="secondary" />
            <Action.SubmitForm
              title="Save"
              onSubmit={onSaveCredentials}
              style="primary"
              isDisabled={!clientIdInput.trim()}
            />
          </ActionPanel>
        }
      >
        <Paper
          markdown={
            "First-time setup: paste your **Google OAuth credentials**.\n\n" +
            "1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)\n" +
            "2. Create an OAuth 2.0 Client ID, type **Desktop app**\n" +
            "3. Ensure **YouTube Data API v3** is enabled for the project\n" +
            "4. Copy the Client ID (and Client Secret if provided)\n\n" +
            "Credentials are stored locally in `~/.config/eney-skills/`."
          }
        />
        <Form.PasswordField
          name="clientId"
          label="OAuth Client ID"
          value={clientIdInput}
          onChange={setClientIdInput}
        />
        <Form.PasswordField
          name="clientSecret"
          label="Client Secret (optional)"
          value={clientSecretInput}
          onChange={setClientSecretInput}
        />
      </Form>
    );
  }

  if (result) {
    return (
      <Form
        header={<CardHeader title="Uploaded to YouTube" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Open on YouTube" onAction={() => openInBrowser(result.url)} style="secondary" />
            <Action.CopyToClipboard title="Copy Link" content={result.url} style="secondary" />
            <Action title="Done" onAction={props.onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`**Published!**\n\n[${result.url}](${result.url})\n\n_Privacy: ${privacy}._`} />
      </Form>
    );
  }

  if (!tokens) {
    return (
      <Form
        header={<CardHeader title="Upload to YouTube" iconBundleId="com.apple.QuickTimePlayerX" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Back" onAction={props.onBack} style="secondary" />
            <Action title="Reset Credentials" onAction={onResetCredentials} style="secondary" />
            <Action
              title={authStatus === "pending" ? "Signing in…" : "Sign in with Google"}
              onAction={onSignIn}
              style="primary"
              isLoading={authStatus === "pending"}
              isDisabled={authStatus === "pending"}
            />
          </ActionPanel>
        }
      >
        <Paper markdown="Sign in with Google to upload to your YouTube channel. The only permission requested is **video upload**." />
        {authError && <Paper markdown={`**Sign-in failed:** ${authError}`} />}
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title="Upload to YouTube" iconBundleId="com.apple.QuickTimePlayerX" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title="Back"
            onAction={props.onBack}
            style="secondary"
            isDisabled={isUploading}
          />
          <Action.SubmitForm
            title={isUploading ? `Uploading… ${progress}%` : "Upload"}
            onSubmit={onUpload}
            style="primary"
            isLoading={isUploading}
            isDisabled={isUploading || !title.trim()}
          />
        </ActionPanel>
      }
    >
      {uploadError && <Paper markdown={`**Error:** ${uploadError}`} />}
      {isUploading && <Paper markdown={`_Uploading ${progress}%…_`} />}
      <Form.TextField name="title" label="Title" value={title} onChange={setTitle} />
      <Form.TextField name="description" label="Description" value={description} onChange={setDescription} />
      <Form.TextField name="tags" label="Tags (comma-separated)" value={tagsInput} onChange={setTagsInput} />
      <Form.Dropdown
        name="privacy"
        label="Privacy"
        value={privacy}
        onChange={(v) => setPrivacy(v as Privacy)}
      >
        <Form.Dropdown.Item value="private" title="Private" />
        <Form.Dropdown.Item value="unlisted" title="Unlisted" />
        <Form.Dropdown.Item value="public" title="Public" />
      </Form.Dropdown>
    </Form>
  );
}

function simpleScreen(title: string, markdown: string) {
  return (
    <Form
      header={<CardHeader title={title} iconBundleId="com.apple.QuickTimePlayerX" />}
      actions={<ActionPanel><Action title="…" onAction={() => {}} isDisabled /></ActionPanel>}
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

function openInBrowser(url: string): void {
  spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
}

function sanitizeClientId(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}
