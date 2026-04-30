import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { generateParagraphs, generateSentences, generateWords } from "../helpers/lorem.js";

type Unit = "paragraphs" | "sentences" | "words";

const schema = z.object({
  count: z.number().int().optional().describe("How many units to generate. Defaults to 3."),
  unit: z.enum(["paragraphs", "sentences", "words"]).optional().describe("Unit to generate. Defaults to 'paragraphs'."),
  startWithLorem: z
    .boolean()
    .optional()
    .describe("Start the output with the classic 'Lorem ipsum dolor sit amet...' opener. Defaults to true."),
});

type Props = z.infer<typeof schema>;

const DEFAULT_COUNT = 3;
const MAX_COUNT = 200;

function generate(unit: Unit, count: number, startWithLorem: boolean): string {
  const safeCount = Math.min(MAX_COUNT, Math.max(1, count));
  if (unit === "words") return generateWords(safeCount, startWithLorem);
  if (unit === "sentences") return generateSentences(safeCount, startWithLorem);
  return generateParagraphs(safeCount, startWithLorem);
}

function GenerateLoremIpsum(props: Props) {
  const closeWidget = useCloseWidget();
  const [count, setCount] = useState<number | null>(props.count ?? DEFAULT_COUNT);
  const [unit, setUnit] = useState<Unit>(props.unit ?? "paragraphs");
  const [startWithLorem, setStartWithLorem] = useState(props.startWithLorem ?? true);
  const [text, setText] = useState("");

  function regenerate() {
    setText(generate(unit, count ?? DEFAULT_COUNT, startWithLorem));
  }

  useEffect(() => {
    regenerate();
  }, [unit, count, startWithLorem]);

  function onDone() {
    if (text) closeWidget(`Generated ${count ?? DEFAULT_COUNT} ${unit} of placeholder text.`);
    else closeWidget("Nothing generated.");
  }

  return (
    <Form
      header={<CardHeader title="Lorem Ipsum" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Regenerate" onAction={regenerate} style="secondary" />
          {text && <Action.CopyToClipboard title="Copy" content={text} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.NumberField name="count" label="Count" value={count} onChange={setCount} min={1} max={MAX_COUNT} />
      <Form.Dropdown name="unit" label="Unit" value={unit} onChange={(v) => setUnit(v as Unit)}>
        <Form.Dropdown.Item title="Paragraphs" value="paragraphs" />
        <Form.Dropdown.Item title="Sentences" value="sentences" />
        <Form.Dropdown.Item title="Words" value="words" />
      </Form.Dropdown>
      <Form.Checkbox
        name="startWithLorem"
        label="Start with classic opener"
        checked={startWithLorem}
        onChange={setStartWithLorem}
        variant="switch"
      />
      {text && <Paper markdown={text} />}
    </Form>
  );
}

const GenerateLoremIpsumWidget = defineWidget({
  name: "generate-lorem-ipsum",
  description: "Generate placeholder lorem ipsum text by words, sentences, or paragraphs.",
  schema,
  component: GenerateLoremIpsum,
});

export default GenerateLoremIpsumWidget;
