import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  label: z.string().describe("Left-side text, e.g. 'build', 'license'."),
  message: z.string().describe("Right-side text, e.g. 'passing', 'MIT'."),
  color: z
    .string()
    .optional()
    .describe("Color name (brightgreen, green, yellow, orange, red, blue, lightgrey, blueviolet) or hex (e.g. ff69b4). Defaults to 'blue'."),
  style: z
    .enum(["flat", "flat-square", "plastic", "for-the-badge", "social"])
    .optional()
    .describe("Badge style. Defaults to 'flat'."),
  logo: z
    .string()
    .optional()
    .describe("Optional simple-icons logo slug, e.g. 'github', 'typescript', 'rust'."),
  link: z.string().optional().describe("Optional link target for both halves of the badge."),
});

type Props = z.infer<typeof schema>;

// Shield URL spec: replace -, _, space per their rules.
function escapeShield(text: string): string {
  return text
    .replace(/-/g, "--")
    .replace(/_/g, "__")
    .replace(/ /g, "_");
}

interface BadgeOptions {
  label: string;
  message: string;
  color: string;
  style: string;
  logo: string;
  link: string;
}

function buildUrl(o: BadgeOptions): string {
  const base = `https://img.shields.io/badge/${encodeURIComponent(escapeShield(o.label))}-${encodeURIComponent(escapeShield(o.message))}-${encodeURIComponent(o.color)}`;
  const params: string[] = [];
  if (o.style && o.style !== "flat") params.push(`style=${encodeURIComponent(o.style)}`);
  if (o.logo) params.push(`logo=${encodeURIComponent(o.logo)}`);
  if (o.link) {
    params.push(`link=${encodeURIComponent(o.link)}`);
    params.push(`link=${encodeURIComponent(o.link)}`);
  }
  return params.length ? `${base}?${params.join("&")}` : base;
}

const COLOR_PRESETS = [
  "brightgreen",
  "green",
  "yellowgreen",
  "yellow",
  "orange",
  "red",
  "blue",
  "lightgrey",
  "blueviolet",
];

function ShieldsBadge(props: Props) {
  const closeWidget = useCloseWidget();
  const [label, setLabel] = useState(props.label);
  const [message, setMessage] = useState(props.message);
  const [color, setColor] = useState(props.color ?? "blue");
  const [style, setStyle] = useState<NonNullable<Props["style"]>>(props.style ?? "flat");
  const [logo, setLogo] = useState(props.logo ?? "");
  const [link, setLink] = useState(props.link ?? "");

  const url = buildUrl({ label, message, color, style, logo, link });
  const markdown = link
    ? `[![${label}: ${message}](${url})](${link})`
    : `![${label}: ${message}](${url})`;
  const html = link
    ? `<a href="${link}"><img src="${url}" alt="${label}: ${message}" /></a>`
    : `<img src="${url}" alt="${label}: ${message}" />`;

  function onApply() {
    // Re-render is automatic; this is a no-op submit so the action stays clickable.
  }

  function onSetColor(c: string) {
    setColor(c);
  }

  function onSetStyle(s: NonNullable<Props["style"]>) {
    setStyle(s);
  }

  function onDone() {
    closeWidget(`Markdown: ${markdown}\nURL: ${url}`);
  }

  const preview = [
    `### Preview`,
    "",
    `![${label}: ${message}](${url})`,
    "",
    `**URL**`,
    "",
    "```",
    url,
    "```",
    "",
    `**Markdown**`,
    "",
    "```markdown",
    markdown,
    "```",
    "",
    `**HTML**`,
    "",
    "```html",
    html,
    "```",
  ].join("\n");

  return (
    <Form
      header={<CardHeader title="Shields.io Badge" iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Apply" onSubmit={onApply} style="primary" />
          <Action title="brightgreen" onAction={() => onSetColor("brightgreen")} style="secondary" />
          <Action title="blue" onAction={() => onSetColor("blue")} style="secondary" />
          <Action title="red" onAction={() => onSetColor("red")} style="secondary" />
          <Action title="orange" onAction={() => onSetColor("orange")} style="secondary" />
          <Action title="flat" onAction={() => onSetStyle("flat")} style="secondary" />
          <Action title="for-the-badge" onAction={() => onSetStyle("for-the-badge")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={preview} />
      <Form.TextField name="label" label="Label (left side)" value={label} onChange={setLabel} />
      <Form.TextField name="message" label="Message (right side)" value={message} onChange={setMessage} />
      <Form.TextField
        name="color"
        label={`Color (named or hex). Common: ${COLOR_PRESETS.slice(0, 6).join(", ")}…`}
        value={color}
        onChange={setColor}
      />
      <Form.TextField
        name="logo"
        label="Logo slug (optional, simple-icons)"
        value={logo}
        onChange={setLogo}
      />
      <Form.TextField
        name="link"
        label="Link URL (optional)"
        value={link}
        onChange={setLink}
      />
    </Form>
  );
}

const ShieldsBadgeWidget = defineWidget({
  name: "make_shields_badge",
  description:
    "Build shields.io badge URLs (and Markdown / HTML snippets) for READMEs. Supports configurable label, message, color (named or hex), style (flat / flat-square / plastic / for-the-badge / social), optional logo via simple-icons slug, and optional link. URL escaping follows shields.io rules.",
  schema,
  component: ShieldsBadge,
});

export default ShieldsBadgeWidget;
