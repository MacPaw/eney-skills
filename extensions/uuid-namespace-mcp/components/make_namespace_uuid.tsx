import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { generate } from "../helpers/namespace-uuid.js";

const schema = z.object({
  name: z.string().describe("Name string to hash into the UUID."),
  namespace: z
    .string()
    .optional()
    .describe(
      "Namespace: 'dns', 'url', 'oid', 'x500', or a UUID literal. Defaults to 'dns'.",
    ),
  version: z.enum(["3", "5"]).optional().describe("UUID version. Defaults to 5."),
});

type Props = z.infer<typeof schema>;

interface State {
  uuid: string;
  uuidV3: string;
  uuidV5: string;
  error: string;
}

function compute(name: string, namespace: string, version: 3 | 5): State {
  try {
    const v3 = generate(3, namespace, name);
    const v5 = generate(5, namespace, name);
    return {
      uuid: version === 3 ? v3 : v5,
      uuidV3: v3,
      uuidV5: v5,
      error: "",
    };
  } catch (err) {
    return { uuid: "", uuidV3: "", uuidV5: "", error: err instanceof Error ? err.message : String(err) };
  }
}

function NamespaceUUID(props: Props) {
  const closeWidget = useCloseWidget();
  const [name, setName] = useState(props.name);
  const [namespace, setNamespace] = useState(props.namespace ?? "dns");
  const [version, setVersion] = useState<3 | 5>((props.version ? Number(props.version) : 5) as 3 | 5);

  const [state, setState] = useState<State>(() =>
    compute(props.name, props.namespace ?? "dns", (props.version ? Number(props.version) : 5) as 3 | 5),
  );

  function recompute(opts?: Partial<{ n: string; ns: string; v: 3 | 5 }>) {
    const ni = opts?.n ?? name;
    const ns = opts?.ns ?? namespace;
    const v = opts?.v ?? version;
    setState(compute(ni, ns, v));
  }

  function onApply() {
    recompute();
  }

  function onSetNamespace(ns: string) {
    setNamespace(ns);
    recompute({ ns });
  }

  function onSetVersion(v: 3 | 5) {
    setVersion(v);
    recompute({ v });
  }

  function onDone() {
    if (state.error) {
      closeWidget(`Error: ${state.error}`);
      return;
    }
    closeWidget(
      `UUIDv${version} for "${name}" in namespace "${namespace}": ${state.uuid}\n` +
      `(v3=${state.uuidV3}, v5=${state.uuidV5})`,
    );
  }

  const markdown = state.error
    ? `**Error:** ${state.error}`
    : [
        `### UUID v${version}`,
        ``,
        `\`${state.uuid}\``,
        ``,
        `| Version | UUID |`,
        `|---|---|`,
        `| v3 (MD5) | \`${state.uuidV3}\` |`,
        `| v5 (SHA-1) | \`${state.uuidV5}\` |`,
        ``,
        `_Namespace-based per RFC 4122 §4.3. Same (namespace, name) always produces the same UUID._`,
      ].join("\n");

  return (
    <Form
      header={<CardHeader title="Namespace UUID" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Generate" onSubmit={onApply} style="primary" />
          <Action title="dns" onAction={() => onSetNamespace("dns")} style="secondary" />
          <Action title="url" onAction={() => onSetNamespace("url")} style="secondary" />
          <Action title="oid" onAction={() => onSetNamespace("oid")} style="secondary" />
          <Action title="x500" onAction={() => onSetNamespace("x500")} style="secondary" />
          <Action title="v3 (MD5)" onAction={() => onSetVersion(3)} style="secondary" />
          <Action title="v5 (SHA-1)" onAction={() => onSetVersion(5)} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="name" label="Name" value={name} onChange={setName} />
      <Form.TextField
        name="namespace"
        label="Namespace (dns / url / oid / x500 / UUID)"
        value={namespace}
        onChange={setNamespace}
      />
    </Form>
  );
}

const NamespaceUUIDWidget = defineWidget({
  name: "make_namespace_uuid",
  description:
    "Generate RFC 4122 namespace UUIDs (v3 MD5 or v5 SHA-1) from a namespace and a name. Pre-defined namespaces: dns, url, oid, x500. Or supply your own UUID as the namespace. Same (namespace, name) always produces the same UUID — useful for stable IDs derived from canonical strings.",
  schema,
  component: NamespaceUUID,
});

export default NamespaceUUIDWidget;
