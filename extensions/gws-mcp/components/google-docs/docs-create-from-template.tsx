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
import { execGws, docsToken, driveToken } from "../../helpers/gws.js";
import { useDocFiles } from "../../helpers/use-doc-files.js";

const schema = z.object({
  templateId: z.string().optional().describe("ID of the Google Doc to use as a template."),
  name: z.string().optional().describe("Name for the new document."),
  text: z.string().optional().describe("Text to append to the new document."),
  shareWith: z.string().optional().describe("Email address to share the new document with."),
});

type Props = z.infer<typeof schema>;

interface CopyResponse {
  id?: string;
  name?: string;
}

function DocsCreateFromTemplate(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { docs, isLoading: isLoadingDocs, error: docsError } = useDocFiles();
  const [templateId, setTemplateId] = useState(props.templateId ?? "");
  const [name, setName] = useState(props.name ?? "");
  const [text, setText] = useState(props.text ?? "");
  const [shareWith, setShareWith] = useState(props.shareWith ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedTemplate = docs.find((d) => d.id === templateId);

  async function onSubmit() {
    if (!templateId || !name) return;
    setIsLoading(true);
    setError("");
    try {
      // Step 1: Copy template
      logger.info(`[docs-from-template] copying templateId=${templateId} name="${name}"`);
      const copyStdout = await execGws(
        `drive files copy --params '${JSON.stringify({ fileId: templateId })}' --json '${JSON.stringify({ name })}'`,
        driveToken()
      );
      const copied = JSON.parse(copyStdout) as CopyResponse;
      const newId = copied.id;
      if (!newId) throw new Error("Copy returned no document ID");
      logger.info(`[docs-from-template] newId=${newId}`);

      // Step 2: Append text (optional)
      if (text) {
        logger.info(`[docs-from-template] appending text`);
        await execGws(
          `docs +write --document ${newId} --text ${JSON.stringify(text)}`,
          docsToken()
        );
      }

      // Step 3: Share (optional)
      if (shareWith) {
        logger.info(`[docs-from-template] sharing with ${shareWith}`);
        await execGws(
          `drive permissions create --params '${JSON.stringify({ fileId: newId })}' --json '${JSON.stringify({ role: "writer", type: "user", emailAddress: shareWith })}'`,
          driveToken()
        );
      }

      const link = `https://docs.google.com/document/d/${newId}/edit`;
      const steps = [
        `✓ Copied from **${selectedTemplate?.name ?? templateId}**`,
        text ? `✓ Text appended` : null,
        shareWith ? `✓ Shared with ${shareWith}` : null,
      ].filter(Boolean).join("\n");

      closeWidget(`${steps}\n${link}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[docs-from-template] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Create from Template" iconBundleId="com.google.drivefs" />;

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
            isDisabled={!templateId || !name}
          />
        </ActionPanel>
      }
    >
      {docsError && <Paper markdown={`**Error loading documents:** ${docsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="templateId" label="Template" value={templateId} onChange={setTemplateId}>
        {isLoadingDocs
          ? [<Form.Dropdown.Item key="loading" title="Loading documents…" value="" />]
          : docs.map((d) => (
              <Form.Dropdown.Item key={d.id} title={d.name} value={d.id} />
            ))}
      </Form.Dropdown>
      <Form.TextField name="name" label="New Document Name" value={name} onChange={setName} />
      <Form.TextField name="text" label="Initial Content (optional)" value={text} onChange={setText} />
      <Form.TextField name="shareWith" label="Share With Email (optional)" value={shareWith} onChange={setShareWith} />
    </Form>
  );
}

const DocsCreateFromTemplateWidget = defineWidget({
  name: "docs-create-from-template",
  description: "Copy a Google Doc as a template, add content, and optionally share it",
  schema,
  component: DocsCreateFromTemplate,
});

export default DocsCreateFromTemplateWidget;
