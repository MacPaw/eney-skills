import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { randomUUID } from "node:crypto";

const schema = z.object({
  count: z.number().int().optional().describe("How many UUIDs to generate. Defaults to 1, max 100."),
  uppercase: z.boolean().optional().describe("Render the UUIDs in uppercase. Defaults to false."),
});

type Props = z.infer<typeof schema>;

const DEFAULT_COUNT = 1;
const MAX_COUNT = 100;

function generate(count: number, uppercase: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = randomUUID();
    out.push(uppercase ? id.toUpperCase() : id);
  }
  return out;
}

function GenerateUuid(props: Props) {
  const closeWidget = useCloseWidget();
  const [count, setCount] = useState<number | null>(
    Math.min(MAX_COUNT, Math.max(1, props.count ?? DEFAULT_COUNT)),
  );
  const [uppercase, setUppercase] = useState(props.uppercase ?? false);
  const [uuids, setUuids] = useState<string[]>([]);

  const safeCount = Math.min(MAX_COUNT, Math.max(1, count ?? DEFAULT_COUNT));

  useEffect(() => {
    setUuids(generate(safeCount, uppercase));
  }, [safeCount, uppercase]);

  function onRegenerate() {
    setUuids(generate(safeCount, uppercase));
  }

  function onDone() {
    closeWidget(uuids.length === 1 ? `UUID: ${uuids[0]}` : `Generated ${uuids.length} UUIDs.`);
  }

  const joined = uuids.join("\n");

  return (
    <Form
      header={<CardHeader title="UUID" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Regenerate" onAction={onRegenerate} style="secondary" />
          {uuids.length > 0 && <Action.CopyToClipboard title="Copy all" content={joined} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.NumberField name="count" label="Count" value={count} onChange={setCount} min={1} max={MAX_COUNT} />
      <Form.Checkbox
        name="uppercase"
        label="Uppercase"
        checked={uppercase}
        onChange={setUppercase}
        variant="switch"
      />
      <Paper markdown={"```\n" + joined + "\n```"} />
    </Form>
  );
}

const GenerateUuidWidget = defineWidget({
  name: "generate-uuid",
  description: "Generate one or more random UUIDs (v4) using the system CSPRNG.",
  schema,
  component: GenerateUuid,
});

export default GenerateUuidWidget;
