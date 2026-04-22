import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";

const CALLBACK_PORT = 1798;
const CALLBACK_PATH = "/callback";
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}${CALLBACK_PATH}`;
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function openUrl(url: string): void {
  spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
}

function waitForCode(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CALLBACK_PORT}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      const successHtml = "<html><body><h2>Signed in!</h2><p>You can close this window.</p></body></html>";
      const failHtml = "<html><body><h2>Sign-in failed</h2><p>Please close and try again.</p></body></html>";

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(failHtml);
        cleanup();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(failHtml);
        cleanup();
        reject(new Error(code ? "OAuth state mismatch" : "OAuth callback missing code"));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successHtml);
      cleanup();
      resolve(code);
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("OAuth timed out after 120 seconds"));
    }, 120_000);

    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }

    server.on("error", (err) => {
      cleanup();
      reject(new Error(`Callback server error: ${err.message}`));
    });
    server.listen(CALLBACK_PORT, "127.0.0.1");
  });
}

async function exchangeCode(
  clientId: string,
  clientSecret: string | null,
  code: string,
  verifier: string,
): Promise<Tokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`Token exchange failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export async function authorizeGoogle(
  clientId: string,
  clientSecret: string | null,
  scopes: string[],
): Promise<Tokens> {
  const { verifier, challenge } = generatePkce();
  const state = base64url(randomBytes(16));

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  const waiter = waitForCode(state);
  openUrl(url.toString());
  const code = await waiter;

  return exchangeCode(clientId, clientSecret, code, verifier);
}

export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string | null,
  refreshToken: string,
): Promise<Tokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(`Token refresh failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}
