import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const STATUS_CODES: Record<number, string> = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  103: "Early Hints",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  208: "Already Reported",
  226: "IM Used",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
};

const KNOWN_CODES = Object.keys(STATUS_CODES).map(Number).sort((a, b) => a - b);

const schema = z.object({
  code: z.number().int().optional().describe("HTTP status code, e.g. 200, 404, 418. Defaults to 418 (I'm a teapot)."),
});

type Props = z.infer<typeof schema>;

function HttpCat(props: Props) {
  const closeWidget = useCloseWidget();
  const [code, setCode] = useState<number>(props.code ?? 418);
  const [errorMsg, setErrorMsg] = useState("");

  const label = STATUS_CODES[code];
  const known = label !== undefined;

  function onShow() {
    if (!Number.isInteger(code) || code < 100 || code > 599) {
      setErrorMsg("Status code must be an integer 100–599.");
    } else {
      setErrorMsg("");
    }
  }

  function onRandom() {
    const next = KNOWN_CODES[Math.floor(Math.random() * KNOWN_CODES.length)];
    setCode(next);
    setErrorMsg("");
  }

  function onDone() {
    if (errorMsg) {
      closeWidget(`Error: ${errorMsg}`);
    } else if (known) {
      closeWidget(`HTTP ${code} — ${label} (https://http.cat/${code})`);
    } else {
      closeWidget(`HTTP ${code} (uncategorised) — https://http.cat/${code}`);
    }
  }

  const url = `https://http.cat/${code}`;
  const markdown = errorMsg
    ? `**Error:** ${errorMsg}`
    : [
        `### 🐈 HTTP **${code}** ${known ? `— ${label}` : "_(uncategorised code)_"}`,
        "",
        `![http.cat/${code}](${url})`,
        "",
        `_[Open image](${url}) · http.cat_`,
      ].join("\n");

  return (
    <Form
      header={<CardHeader title="HTTP Cat" iconBundleId="com.apple.Emoji" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Show" onSubmit={onShow} style="primary" />
          <Action title="Random" onAction={onRandom} style="secondary" />
          <Action title="404" onAction={() => setCode(404)} style="secondary" />
          <Action title="418" onAction={() => setCode(418)} style="secondary" />
          <Action title="500" onAction={() => setCode(500)} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="code"
        label="HTTP status code (100–599)"
        value={code}
        onChange={(v) => setCode(Math.floor(Number(v) || 0))}
      />
    </Form>
  );
}

const HttpCatWidget = defineWidget({
  name: "http_status_cat",
  description:
    "Show a cat image for an HTTP status code via http.cat. Recognises ~70 standard status codes (100–511) including the famous 418 I'm a teapot. Random button picks one at random.",
  schema,
  component: HttpCat,
});

export default HttpCatWidget;
