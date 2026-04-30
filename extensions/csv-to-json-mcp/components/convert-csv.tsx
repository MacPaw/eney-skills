import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { parseCsv } from "../helpers/csv.js";

const schema = z.object({
  csv: z.string().optional().describe("The CSV text to convert."),
  delimiter: z.string().optional().describe("Field delimiter, e.g. ',' or '\\t'. Defaults to ','."),
  hasHeader: z.boolean().optional().describe("Treat the first row as column names. Defaults to true."),
  pretty: z.boolean().optional().describe("Pretty-print the JSON output. Defaults to true."),
});

type Props = z.infer<typeof schema>;

function ConvertCsv(props: Props) {
  const closeWidget = useCloseWidget();
  const [csv, setCsv] = useState(props.csv ?? "");
  const [delimiter, setDelimiter] = useState(props.delimiter ?? ",");
  const [hasHeader, setHasHeader] = useState(props.hasHeader ?? true);
  const [pretty, setPretty] = useState(props.pretty ?? true);

  const result = useMemo(
    () => (csv.trim() ? parseCsv(csv, { delimiter: delimiter || ",", hasHeader }) : null),
    [csv, delimiter, hasHeader],
  );

  const json = useMemo(() => {
    if (!result || !result.ok) return "";
    return pretty ? JSON.stringify(result.rows, null, 2) : JSON.stringify(result.rows);
  }, [result, pretty]);

  function onDone() {
    if (!result) closeWidget("Nothing to convert.");
    else if (!result.ok) closeWidget(`Error: ${result.error}`);
    else closeWidget(`Converted ${result.rows.length} row(s).`);
  }

  return (
    <Form
      header={<CardHeader title="CSV to JSON" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          {json && <Action.CopyToClipboard title="Copy JSON" content={json} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="csv" label="CSV" value={csv} onChange={setCsv} />
      <Form.TextField name="delimiter" label="Delimiter" value={delimiter} onChange={setDelimiter} />
      <Form.Checkbox name="hasHeader" label="First row is header" checked={hasHeader} onChange={setHasHeader} variant="switch" />
      <Form.Checkbox name="pretty" label="Pretty-print" checked={pretty} onChange={setPretty} variant="switch" />
      {result && !result.ok && <Paper markdown={`**Error:** ${result.error}`} />}
      {result?.ok && (
        <Paper
          markdown={
            `**${result.rows.length} row(s), ${result.columnCount} column(s)**\n\n` + "```json\n" + json + "\n```"
          }
        />
      )}
    </Form>
  );
}

const ConvertCsvWidget = defineWidget({
  name: "convert-csv",
  description:
    "Convert CSV text to JSON. Configurable delimiter (',' default; use '\\t' for TSV) and whether the first row is a header (default yes — output is array of objects keyed by column name; otherwise array of arrays).",
  schema,
  component: ConvertCsv,
});

export default ConvertCsvWidget;
