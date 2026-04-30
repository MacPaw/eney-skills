import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { Alignment, parseRows, rowsToMarkdownTable } from "../helpers/parse.js";

const schema = z.object({
  csv: z.string().optional().describe("CSV or TSV text to convert."),
  delimiter: z.string().optional().describe("Field delimiter. Defaults to ',' (use '\\t' for TSV)."),
  hasHeader: z.boolean().optional().describe("Treat the first row as the header. Defaults to true."),
  alignment: z.enum(["left", "center", "right", "none"]).optional().describe("Column alignment. Defaults to 'none'."),
});

type Props = z.infer<typeof schema>;

function CsvToMarkdownTable(props: Props) {
  const closeWidget = useCloseWidget();
  const [csv, setCsv] = useState(props.csv ?? "");
  const [delimiter, setDelimiter] = useState(props.delimiter ?? ",");
  const [hasHeader, setHasHeader] = useState(props.hasHeader ?? true);
  const [alignment, setAlignment] = useState<Alignment>(props.alignment ?? "none");

  const markdown = useMemo(() => {
    if (!csv.trim()) return "";
    const rows = parseRows(csv, delimiter || ",");
    if (!rows.length) return "";
    return rowsToMarkdownTable(rows, hasHeader, alignment);
  }, [csv, delimiter, hasHeader, alignment]);

  function onDone() {
    if (!markdown) closeWidget("Nothing converted.");
    else closeWidget(`Generated a ${markdown.split("\n").length}-line Markdown table.`);
  }

  return (
    <Form
      header={<CardHeader title="CSV to Markdown Table" iconBundleId="com.apple.TextEdit" />}
      actions={
        <ActionPanel layout="row">
          {markdown && <Action.CopyToClipboard title="Copy" content={markdown} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.TextField name="csv" label="CSV / TSV" value={csv} onChange={setCsv} />
      <Form.TextField name="delimiter" label="Delimiter" value={delimiter} onChange={setDelimiter} />
      <Form.Checkbox name="hasHeader" label="First row is header" checked={hasHeader} onChange={setHasHeader} variant="switch" />
      <Form.Dropdown
        name="alignment"
        label="Column alignment"
        value={alignment}
        onChange={(v) => setAlignment(v as Alignment)}
      >
        <Form.Dropdown.Item title="None" value="none" />
        <Form.Dropdown.Item title="Left" value="left" />
        <Form.Dropdown.Item title="Center" value="center" />
        <Form.Dropdown.Item title="Right" value="right" />
      </Form.Dropdown>
      {markdown && <Paper markdown={"```markdown\n" + markdown + "\n```"} />}
      {markdown && <Paper markdown={`**Preview**\n\n${markdown}`} />}
    </Form>
  );
}

const CsvToMarkdownTableWidget = defineWidget({
  name: "csv-to-markdown-table",
  description:
    "Convert CSV or TSV data into a GitHub-flavored Markdown table. Configurable delimiter (use '\\t' for TSV), header behaviour (synthetic 'Column N' headers when off), and column alignment.",
  schema,
  component: CsvToMarkdownTable,
});

export default CsvToMarkdownTableWidget;
