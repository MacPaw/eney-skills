import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { createHash } from "node:crypto";

const ALGORITHMS = ["md5", "sha1", "sha256", "sha512"] as const;
type Algorithm = (typeof ALGORITHMS)[number];

const schema = z.object({
  text: z.string().optional().describe("The text to hash."),
  algorithm: z.enum(ALGORITHMS).optional().describe("Hash algorithm. Defaults to sha256."),
  uppercase: z.boolean().optional().describe("Uppercase the hex digest. Defaults to false."),
});

type Props = z.infer<typeof schema>;

const ALGORITHM_LABELS: Record<Algorithm, string> = {
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
};

function HashText(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [algorithm, setAlgorithm] = useState<Algorithm>(props.algorithm ?? "sha256");
  const [uppercase, setUppercase] = useState(props.uppercase ?? false);

  const digest = useMemo(() => {
    if (!text) return "";
    const hex = createHash(algorithm).update(text, "utf8").digest("hex");
    return uppercase ? hex.toUpperCase() : hex;
  }, [text, algorithm, uppercase]);

  function onDone() {
    if (digest) closeWidget(`${ALGORITHM_LABELS[algorithm]}: ${digest}`);
    else closeWidget("Nothing hashed.");
  }

  return (
    <Form
      header={<CardHeader title="Hash Text" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {digest && <Action.CopyToClipboard title="Copy digest" content={digest} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.Dropdown
        name="algorithm"
        label="Algorithm"
        value={algorithm}
        onChange={(v) => setAlgorithm(v as Algorithm)}
      >
        {ALGORITHMS.map((alg) => (
          <Form.Dropdown.Item key={alg} title={ALGORITHM_LABELS[alg]} value={alg} />
        ))}
      </Form.Dropdown>
      <Form.Checkbox name="uppercase" label="Uppercase" checked={uppercase} onChange={setUppercase} variant="switch" />
      {digest && <Paper markdown={"```\n" + digest + "\n```"} />}
    </Form>
  );
}

const HashTextWidget = defineWidget({
  name: "hash-text",
  description:
    "Compute MD5, SHA-1, SHA-256, or SHA-512 hex digest of text. MD5 and SHA-1 are display-only — do not use for new security work.",
  schema,
  component: HashText,
});

export default HashTextWidget;
