'use client';

import { useState, type SubmitEvent } from 'react';

interface FormState {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
}

interface EncodeResult {
  authorizeUrl: string;
  tokenUrl: string;
}

const INITIAL_FORM: FormState = {
  clientId: '',
  clientSecret: '',
  authorizeUrl: '',
  tokenUrl: '',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    if (timeoutId) clearTimeout(timeoutId);
    const newTimeoutId = setTimeout(() => setCopied(false), 2000);
    setTimeoutId(newTimeoutId);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded border border-fd-border text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-primary transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ResultRow({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-fd-foreground">{label}</label>
        <CopyButton value={value} />
      </div>
      <p className="text-xs text-fd-muted-foreground">{description}</p>
      <div className="rounded-lg border border-fd-border bg-fd-muted p-3 font-mono text-xs break-all text-fd-foreground/80">
        {value}
      </div>
    </div>
  );
}

export default function OAuthProxyPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<EncodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('https://extensions.api.eney.ai/api/v1/public/oauth-proxy/encode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Request failed (${res.status}): ${text}`);
      }

      const data: EncodeResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const isValid = form.clientId && form.clientSecret && form.authorizeUrl && form.tokenUrl;

  const codeExample = result
    ? `const oauthConfig: OAuthConfig = {
  authorizeUrl: "${result.authorizeUrl}",
  tokenUrl: "${result.tokenUrl}",
  scopes: ["read", "write"],
  clientId: "your-client-id",
};

const { status, tokens, error, refresh, authorize } = useOAuth(oauthConfig);
` : '';

  return (
    <div className="min-h-screen bg-fd-background flex flex-col">
      <header className="border-b border-fd-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/eney-logo.png" alt="Eney" className="w-6 h-6" />
            <span className="font-semibold text-fd-foreground">Eney OAuth Proxy</span>
          </div>
          <a
            href="/docs/getting-started"
            className="text-sm text-fd-muted-foreground hover:text-fd-foreground transition-colors"
          >
            View Docs
          </a>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto space-y-10">
          {!result ? (
            <>
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-fd-foreground">Encode OAuth Config</h1>
                <p className="text-fd-muted-foreground leading-relaxed">
                  Enter your OAuth credentials to generate encoded proxy URLs. Paste the resulting URLs into
                  your extension's <code className="text-fd-primary text-sm font-mono">OAuthConfig</code> — the proxy
                  handles token exchange without exposing your secrets.
                </p>
                <p className="text-sm text-fd-muted-foreground bg-fd-muted rounded-lg px-4 py-3 border border-fd-border">
                  Your credentials are sent directly to the Eney backend and are never stored or logged.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">
                  {([
                    { name: 'clientId', label: 'Client ID', placeholder: 'your-client-id', type: 'text' },
                    { name: 'clientSecret', label: 'Client Secret', placeholder: 'your-client-secret', type: 'password' },
                    { name: 'authorizeUrl', label: 'Authorize URL', placeholder: 'https://provider.com/oauth/authorize', type: 'url' },
                    { name: 'tokenUrl', label: 'Token URL', placeholder: 'https://provider.com/oauth/token', type: 'url' },
                  ] as const).map(({ name, label, placeholder, type }) => (
                    <div key={name} className="space-y-1.5">
                      <label htmlFor={name} className="block text-sm font-medium text-fd-foreground">
                        {label} <span className="text-fd-primary">*</span>
                      </label>
                      <input
                        id={name}
                        name={name}
                        type={type}
                        value={form[name]}
                        onChange={handleChange}
                        placeholder={placeholder}
                        required
                        className="w-full rounded-lg border border-fd-border bg-fd-card text-fd-foreground placeholder:text-fd-muted-foreground px-3 py-2 text-sm outline-none focus:border-fd-primary focus:ring-2 focus:ring-fd-ring/30 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full rounded-lg bg-fd-primary text-fd-primary-foreground font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {loading ? 'Encoding…' : 'Generate Encoded URLs'}
                </button>
              </form>

              {error && (
                <div className="rounded-lg border border-red-300/50 bg-red-50/50 dark:bg-red-950/20 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-fd-foreground">Encoded URLs</h1>
                <button
                  onClick={() => { setResult(null); setForm(INITIAL_FORM); setError(null); }}
                  className="text-sm text-fd-muted-foreground hover:text-fd-foreground transition-colors"
                >
                  ← Start over
                </button>
              </div>

              <div className="space-y-5">
                <ResultRow
                  label="Authorize URL"
                  value={result.authorizeUrl}
                  description="Use this as authorizeUrl in your OAuthConfig."
                />
                <ResultRow
                  label="Token URL"
                  value={result.tokenUrl}
                  description="Use this as tokenUrl in your OAuthConfig. Handles both authorization_code and refresh_token grants."
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-fd-foreground">Usage Example</h2>
                  <CopyButton value={codeExample} />
                </div>
                <p className="text-sm text-fd-muted-foreground">
                  Paste the encoded URLs into your extension's <code className="text-fd-primary font-mono">OAuthConfig</code>:
                </p>
                <pre className="rounded-lg border border-fd-border bg-fd-muted p-4 text-xs font-mono text-fd-foreground/80 overflow-x-auto whitespace-pre">
                  {codeExample}
                </pre>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-fd-border px-6 py-4 text-center text-xs text-fd-muted-foreground">
        Eney by MacPaw
      </footer>
    </div>
  );
}
