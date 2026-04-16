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
import { execGws, driveToken } from "../../helpers/gws.js";
import { useSlidesFiles } from "../../helpers/use-slides-files.js";

const schema = z.object({
  templateId: z.string().optional().describe("ID of the Google Slides presentation to use as a template."),
  name: z.string().optional().describe("Name for the new presentation."),
  shareWith: z.string().optional().describe("Email address to share the new presentation with."),
});

type Props = z.infer<typeof schema>;

interface CopyResponse {
  id?: string;
  name?: string;
}

function SlidesFromTemplate(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { presentations, isLoading: isLoadingPresentations, error: presentationsError } = useSlidesFiles();
  const [templateId, setTemplateId] = useState(props.templateId ?? "");
  const [name, setName] = useState(props.name ?? "");
  const [shareWith, setShareWith] = useState(props.shareWith ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!templateId || !name) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[slides-from-template] copying templateId=${templateId} name="${name}"`);
      const copyStdout = await execGws(
        `drive files copy --params '${JSON.stringify({ fileId: templateId })}' --json '${JSON.stringify({ name })}'`,
        driveToken()
      );
      const copied = JSON.parse(copyStdout) as CopyResponse;
      const newId = copied.id;
      if (!newId) throw new Error("Copy returned no presentation ID");
      logger.info(`[slides-from-template] newId=${newId}`);

      if (shareWith.trim()) {
        logger.info(`[slides-from-template] sharing with ${shareWith}`);
        await execGws(
          `drive permissions create --params '${JSON.stringify({ fileId: newId })}' --json '${JSON.stringify({ role: "writer", type: "user", emailAddress: shareWith.trim() })}'`,
          driveToken()
        );
      }

      const link = `https://docs.google.com/presentation/d/${newId}/edit`;
      closeWidget(link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[slides-from-template] error=${msg}`);
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
            title={isLoading ? "Creating…" : "Create Presentation"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!templateId || !name}
          />
        </ActionPanel>
      }
    >
      {presentationsError && <Paper markdown={`**Error loading presentations:** ${presentationsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="templateId" label="Template" value={templateId} onChange={setTemplateId}>
        {isLoadingPresentations
          ? [<Form.Dropdown.Item key="loading" title="Loading presentations…" value="" />]
          : presentations.map((p) => (
              <Form.Dropdown.Item key={p.id} title={p.name} value={p.id} />
            ))}
      </Form.Dropdown>
      <Form.TextField name="name" label="New Presentation Name" value={name} onChange={setName} />
      <Form.TextField name="shareWith" label="Share With Email (optional)" value={shareWith} onChange={setShareWith} />
    </Form>
  );
}

const SlidesFromTemplateWidget = defineWidget({
  name: "slides-from-template",
  description: "Copy a Google Slides presentation as a template and optionally share it",
  schema,
  component: SlidesFromTemplate,
});

export default SlidesFromTemplateWidget;
