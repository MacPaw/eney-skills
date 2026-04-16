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
import { execGws, slidesToken, driveToken } from "../../helpers/gws.js";
import { useDriveFolders } from "../../helpers/use-drive-folders.js";

const schema = z.object({
  title: z.string().optional().describe("Title for the new presentation."),
  firstSlideTitle: z.string().optional().describe("Title text for the first slide."),
  firstSlideBody: z.string().optional().describe("Body text for the first slide."),
  folderId: z.string().optional().describe("ID of the Drive folder to place the presentation in."),
});

type Props = z.infer<typeof schema>;

interface PageElement {
  objectId: string;
  shape?: { placeholder?: { type: string } };
}

interface Slide {
  pageElements?: PageElement[];
}

interface PresentationResponse {
  presentationId?: string;
  title?: string;
  slides?: Slide[];
}

function SlidesCreate(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { folders, isLoading: isLoadingFolders } = useDriveFolders();

  const [title, setTitle] = useState(props.title ?? "");
  const [firstSlideTitle, setFirstSlideTitle] = useState(props.firstSlideTitle ?? "");
  const [firstSlideBody, setFirstSlideBody] = useState(props.firstSlideBody ?? "");
  const [folderId, setFolderId] = useState(props.folderId ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!title) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[slides-create] title="${title}"`);

      // Step 1: Create presentation (response includes first slide with placeholder IDs)
      const stdout = await execGws(
        `slides presentations create --json '${JSON.stringify({ title })}'`,
        slidesToken()
      );
      const presentation = JSON.parse(stdout) as PresentationResponse;
      const presentationId = presentation.presentationId ?? "";
      logger.info(`[slides-create] presentationId=${presentationId}`);

      // Step 2: Insert content into first slide placeholders
      if ((firstSlideTitle.trim() || firstSlideBody.trim()) && presentationId) {
        const elements = presentation.slides?.[0]?.pageElements ?? [];
        const titleEl = elements.find(
          el =>
            el.shape?.placeholder?.type === "CENTERED_TITLE" ||
            el.shape?.placeholder?.type === "TITLE"
        );
        const bodyEl = elements.find(
          el =>
            el.shape?.placeholder?.type === "SUBTITLE" ||
            el.shape?.placeholder?.type === "BODY"
        );

        const requests: object[] = [];
        if (firstSlideTitle.trim() && titleEl) {
          requests.push({ insertText: { objectId: titleEl.objectId, insertionIndex: 0, text: firstSlideTitle.trim() } });
        }
        if (firstSlideBody.trim() && bodyEl) {
          requests.push({ insertText: { objectId: bodyEl.objectId, insertionIndex: 0, text: firstSlideBody.trim() } });
        }
        if (requests.length > 0) {
          logger.info(`[slides-create] batchUpdate requests=${requests.length}`);
          await execGws(
            `slides presentations batchUpdate --params '${JSON.stringify({ presentationId })}' --json '${JSON.stringify({ requests })}'`,
            slidesToken()
          );
        }
      }

      // Step 3: Move to folder
      if (folderId && presentationId) {
        logger.info(`[slides-create] moving to folderId=${folderId}`);
        await execGws(
          `drive files update --params '${JSON.stringify({ fileId: presentationId, addParents: folderId, removeParents: "root" })}' --json '{}'`,
          driveToken()
        );
      }

      const link = `https://docs.google.com/presentation/d/${presentationId}/edit`;
      closeWidget(link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[slides-create] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Create Presentation" iconBundleId="com.google.drivefs" />;

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
            isDisabled={!title}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="title" label="Presentation Title" value={title} onChange={setTitle} />
      <Form.TextField name="firstSlideTitle" label="First Slide Title (optional)" value={firstSlideTitle} onChange={setFirstSlideTitle} />
      <Form.TextField name="firstSlideBody" label="First Slide Body (optional)" value={firstSlideBody} onChange={setFirstSlideBody} />
      <Form.Dropdown name="folderId" label="Folder" value={folderId} onChange={setFolderId}>
        <Form.Dropdown.Item key="root" title="My Drive (root)" value="" />
        {isLoadingFolders
          ? [<Form.Dropdown.Item key="loading" title="Loading folders…" value="__loading__" />]
          : folders.map((f) => (
              <Form.Dropdown.Item key={f.id} title={f.name} value={f.id} />
            ))}
      </Form.Dropdown>
    </Form>
  );
}

const SlidesCreateWidget = defineWidget({
  name: "slides-create",
  description: "Create a new Google Slides presentation with optional first slide content and folder placement",
  schema,
  component: SlidesCreate,
});

export default SlidesCreateWidget;
