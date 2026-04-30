import { useState } from "react";
import { z } from "zod";
import { format } from "sql-formatter";
import type { SqlLanguage } from "sql-formatter";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const DIALECTS = [
  "sql",
  "postgresql",
  "mysql",
  "sqlite",
  "mariadb",
  "bigquery",
  "snowflake",
  "redshift",
  "spark",
  "trino",
  "duckdb",
  "tsql",
  "plsql",
  "db2",
  "clickhouse",
] as const;

const schema = z.object({
  sql: z.string().describe("Raw SQL query to format."),
  dialect: z
    .enum(DIALECTS)
    .optional()
    .describe(`SQL dialect. One of: ${DIALECTS.join(", ")}. Defaults to 'sql' (generic).`),
  keywordCase: z
    .enum(["preserve", "upper", "lower"])
    .optional()
    .describe("Keyword casing. Defaults to 'preserve'."),
  tabWidth: z
    .number()
    .int()
    .optional()
    .describe("Indent width in spaces. Defaults to 2."),
});

type Props = z.infer<typeof schema>;

interface FormatState {
  output: string;
  error: string;
}

function safeFormat(
  sql: string,
  dialect: SqlLanguage,
  keywordCase: "preserve" | "upper" | "lower",
  tabWidth: number,
): FormatState {
  if (!sql.trim()) return { output: "", error: "" };
  try {
    const out = format(sql, {
      language: dialect,
      keywordCase,
      tabWidth,
    });
    return { output: out, error: "" };
  } catch (err) {
    return {
      output: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function FormatSql(props: Props) {
  const closeWidget = useCloseWidget();
  const [sql, setSql] = useState(props.sql ?? "");
  const [dialect, setDialect] = useState<SqlLanguage>((props.dialect ?? "sql") as SqlLanguage);
  const [keywordCase, setKeywordCase] = useState<"preserve" | "upper" | "lower">(
    props.keywordCase ?? "preserve",
  );
  const [tabWidth, setTabWidth] = useState<number>(props.tabWidth ?? 2);

  const initial = safeFormat(props.sql ?? "", dialect, keywordCase, tabWidth);
  const [state, setState] = useState<FormatState>(initial);

  function onFormat() {
    setState(safeFormat(sql, dialect, keywordCase, tabWidth));
  }

  function onUpper() {
    setKeywordCase("upper");
    setState(safeFormat(sql, dialect, "upper", tabWidth));
  }

  function onPreserve() {
    setKeywordCase("preserve");
    setState(safeFormat(sql, dialect, "preserve", tabWidth));
  }

  function onDone() {
    if (state.error) {
      closeWidget(`SQL formatter error: ${state.error}`);
    } else if (state.output) {
      closeWidget(state.output);
    } else {
      closeWidget("No SQL provided.");
    }
  }

  const markdown = state.error
    ? `**Error:** ${state.error}`
    : state.output
      ? `\`\`\`sql\n${state.output}\n\`\`\``
      : "_Paste a SQL query and tap **Format**._";

  return (
    <Form
      header={<CardHeader title={`SQL Formatter (${dialect})`} iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Format" onSubmit={onFormat} style="primary" />
          <Action title="UPPER keywords" onAction={onUpper} style="secondary" />
          <Action title="Preserve case" onAction={onPreserve} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="sql"
        label="SQL"
        value={sql}
        onChange={setSql}
      />
      <Form.TextField
        name="dialect"
        label={`Dialect (${DIALECTS.join(", ")})`}
        value={dialect}
        onChange={(v) => setDialect((v.toLowerCase() as SqlLanguage) || "sql")}
      />
      <Form.NumberField
        name="tabWidth"
        label="Tab width"
        value={tabWidth}
        onChange={(v) => setTabWidth(Math.max(1, Math.min(8, Number(v) || 2)))}
      />
    </Form>
  );
}

const SqlFormatterWidget = defineWidget({
  name: "format_sql",
  description:
    "Format and pretty-print SQL queries using the sql-formatter package. Supports many dialects (postgresql, mysql, snowflake, bigquery, etc.). Configurable keyword case and indent width.",
  schema,
  component: FormatSql,
});

export default SqlFormatterWidget;
