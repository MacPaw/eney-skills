import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Divider,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
  useLogger,
} from "@eney/api";
import { execGws, docsToken } from "../../helpers/gws.js";

const schema = z.object({
  title: z.string().optional().describe("Title for the new Google Doc."),
});

type Props = z.infer<typeof schema>;

interface DocResponse {
  documentId?: string;
  title?: string;
}

function DocsCreate(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const [title, setTitle] = useState(props.title ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!title) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[docs-create] title="${title}"`);
      const stdout = await execGws(
        `docs documents create --json '${JSON.stringify({ title })}'`,
        docsToken(),
        logger
      );
      const doc = JSON.parse(stdout) as DocResponse;
      logger.info(`[docs-create] documentId=${doc.documentId}`);
      const link = `https://docs.google.com/document/d/${doc.documentId}/edit`;
      setResult(
        `**Document created successfully**\n\n| | |\n| --- | --- |\n| **Title** | ${doc.title ?? title} |\n| **ID** | \`${doc.documentId ?? "—"}\` |\n| **Link** | [Open in Docs](${link}) |`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[docs-create] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Create Document" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Create Another" onSubmit={() => { setResult(""); setTitle(""); }} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(result)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <Action.SubmitForm
            title={isLoading ? "Creating…" : "Create Document"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!title}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="title" label="Document Title" value={title} onChange={setTitle} />
    </Form>
  );
}

const DocsCreateWidget = defineWidget({
  name: "docs-create",
  description: "Create a new blank Google Doc",
  schema,
  component: DocsCreate,
});

export default DocsCreateWidget;
