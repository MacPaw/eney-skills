import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  text: z.string().optional().describe("The text to spell out in the NATO phonetic alphabet."),
});

type Props = z.infer<typeof schema>;

const NATO: Record<string, string> = {
  A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X-ray",
  Y: "Yankee", Z: "Zulu",
  "0": "Zero", "1": "One", "2": "Two", "3": "Three", "4": "Four",
  "5": "Five", "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine",
};

function spell(text: string): string {
  const upper = text.toUpperCase();
  const tokens: string[] = [];
  for (const char of upper) {
    if (char === " ") {
      tokens.push("(space)");
    } else if (NATO[char]) {
      tokens.push(NATO[char]);
    } else {
      tokens.push(`'${char}'`);
    }
  }
  return tokens.join(" ");
}

function SpellNato(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");

  const spelled = useMemo(() => (text ? spell(text) : ""), [text]);

  function onDone() {
    if (spelled) closeWidget(spelled);
    else closeWidget("Nothing spelled.");
  }

  return (
    <Form
      header={<CardHeader title="NATO Phonetic" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {spelled && <Action.CopyToClipboard title="Copy" content={spelled} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      {spelled && <Paper markdown={spelled} />}
    </Form>
  );
}

const SpellNatoWidget = defineWidget({
  name: "spell-nato",
  description:
    "Spell text out using the NATO/ICAO phonetic alphabet (Alfa, Bravo, Charlie...). Letters and digits map to standard codewords; spaces become `(space)`; other characters are passed through quoted.",
  schema,
  component: SpellNato,
});

export default SpellNatoWidget;
