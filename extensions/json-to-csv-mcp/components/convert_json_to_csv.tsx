import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { convert, type ConvertOptions, type ConvertResult, type Delimiter } from "../helpers/json-to-csv.js";

const schema = z.object({
  json: z.string().describe("JSON input. Either an array of objects or a single object."),
  delimiter: z
    .enum([",", ";", "\\t", "|"])
    .optional()
    .describe("Field delimiter. Use '\\t' for tabs. Defaults to ','."),
  flatten: z
    .boolean()
    .optional()
    .describe("Flatten nested objects with dot-paths (e.g. user.name). Defaults to true."),
  forceQuoteAll: z
    .boolean()
    .optional()
    .describe("Always wrap every cell in double quotes. Defaults to false."),
});

type Props = z.infer<typeof schema>;

function decodeDelimiter(d: string | undefined): Delimiter {
  if (d === "\\t" || d === "\t") return "\t";
  if (d === ";" || d === "|") return d;
  return ",";
}

interface State {
  result: ConvertResult | null;
  error: string;
}

function safeConvert(input: string, opts: ConvertOptions): State {
  try {
    return { result: convert(input, opts), error: "" };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function ConvertJsonToCsv(props: Props) {
  const closeWidget = useCloseWidget();
  const [json, setJson] = useState(props.json);
  const [delimiter, setDelimiter] = useState<Delimiter>(decodeDelimiter(props.delimiter));
  const [flatten, setFlatten] = useState<boolean>(props.flatten ?? true);
  const [forceQuoteAll, setForceQuoteAll] = useState<boolean>(props.forceQuoteAll ?? false);
  const [state, setState] = useState<State>(() =>
    safeConvert(props.json, {
      delimiter: decodeDelimiter(props.delimiter),
      flatten: props.flatten ?? true,
      forceQuoteAll: props.forceQuoteAll ?? false,
    }),
  );

  function recompute(opts?: Partial<ConvertOptions>) {
    const merged: ConvertOptions = {
      delimiter,
      flatten,
      forceQuoteAll,
      ...opts,
    };
    setState(safeConvert(json, merged));
  }

  function onConvert() {
    recompute();
  }

  function onSetDelimiter(d: Delimiter) {
    setDelimiter(d);
    recompute({ delimiter: d });
  }

  function onToggleFlatten() {
    const v = !flatten;
    setFlatten(v);
    recompute({ flatten: v });
  }

  function onToggleForceQuote() {
    const v = !forceQuoteAll;
    setForceQuoteAll(v);
    recompute({ forceQuoteAll: v });
  }

  function onDone() {
    if (state.error) {
      closeWidget(`Error: ${state.error}`);
    } else if (state.result) {
      closeWidget(state.result.csv);
    } else {
      closeWidget("No CSV produced.");
    }
  }

  const delimiterLabel =
    delimiter === "\t" ? "Tab" : delimiter === "," ? "Comma" : delimiter === ";" ? "Semicolon" : "Pipe";

  let markdown: string;
  if (state.error) {
    markdown = `**Error:** ${state.error}`;
  } else if (state.result && state.result.rowCount > 0) {
    const preview = state.result.csv.length > 4000
      ? state.result.csv.slice(0, 4000) + "\n…(truncated for preview)"
      : state.result.csv;
    markdown = [
      `**${state.result.rowCount}** rows × **${state.result.columnCount}** columns · delimiter: ${delimiterLabel}`,
      ``,
      `\`\`\`csv`,
      preview,
      `\`\`\``,
    ].join("\n");
  } else {
    markdown = "_Paste JSON and tap **Convert**._";
  }

  return (
    <Form
      header={<CardHeader title="JSON → CSV" iconBundleId="com.apple.iWork.Numbers" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Convert" onSubmit={onConvert} style="primary" />
          <Action title="Comma" onAction={() => onSetDelimiter(",")} style="secondary" />
          <Action title="Semicolon" onAction={() => onSetDelimiter(";")} style="secondary" />
          <Action title="Tab" onAction={() => onSetDelimiter("\t")} style="secondary" />
          <Action
            title={flatten ? "Don't flatten" : "Flatten nested"}
            onAction={onToggleFlatten}
            style="secondary"
          />
          <Action
            title={forceQuoteAll ? "Quote only when needed" : "Quote all cells"}
            onAction={onToggleForceQuote}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="json" label="JSON input" value={json} onChange={setJson} />
    </Form>
  );
}

const JsonToCsvWidget = defineWidget({
  name: "convert_json_to_csv",
  description:
    "Convert a JSON array of objects (or a single object) to CSV. Supports comma, semicolon, tab, and pipe delimiters. Optional flattening of nested objects via dot-paths and forced quoting of all cells. RFC-4180 escaping.",
  schema,
  component: ConvertJsonToCsv,
});

export default JsonToCsvWidget;
