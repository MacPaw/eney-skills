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
  presentationId: z.string().optional().describe("ID of the Google Slides presentation to add a slide to."),
  slideTitle: z.string().optional().describe("Title text for the new slide."),
  slideBody: z.string().optional().describe("Body text for the new slide. Only used with TITLE_AND_BODY layout."),
  layout: z.string().optional().describe("Slide layout: TITLE_AND_BODY, TITLE_ONLY, or BLANK."),
});

type Props = z.infer<typeof schema>;

interface SlideCountResponse {
  slides?: unknown[];
}

function SlidesAddSlide(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { presentations, isLoading: isLoadingPresentations, error: presentationsError } = useSlidesFiles();
  const [presentationId, setPresentationId] = useState(props.presentationId ?? "");
  const [slideTitle, setSlideTitle] = useState(props.slideTitle ?? "");
  const [slideBody, setSlideBody] = useState(props.slideBody ?? "");
  const [layout, setLayout] = useState(props.layout ?? "TITLE_AND_BODY");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!presentationId) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[slides-add-slide] presentationId=${presentationId} layout=${layout}`);

      // Get current slide count to determine insertion index
      const getStdout = await execGws(
        `slides presentations get --params '${JSON.stringify({ presentationId })}'`,
        driveToken()
      );
      const current = JSON.parse(getStdout) as SlideCountResponse;
      const insertionIndex = (current.slides ?? []).length;

      const ts = Date.now();
      const titleId = `title_${ts}`;
      const bodyId = `body_${ts}`;

      const placeholderIdMappings: object[] = [];
      if (layout !== "BLANK") {
        placeholderIdMappings.push({
          layoutPlaceholder: { type: "TITLE", index: 0 },
          objectId: titleId,
        });
        if (layout === "TITLE_AND_BODY") {
          placeholderIdMappings.push({
            layoutPlaceholder: { type: "BODY", index: 0 },
            objectId: bodyId,
          });
        }
      }

      const requests: object[] = [
        {
          createSlide: {
            insertionIndex,
            slideLayoutReference: { predefinedLayout: layout },
            ...(placeholderIdMappings.length > 0 ? { placeholderIdMappings } : {}),
          },
        },
      ];

      if (slideTitle.trim() && layout !== "BLANK") {
        requests.push({ insertText: { objectId: titleId, insertionIndex: 0, text: slideTitle.trim() } });
      }
      if (slideBody.trim() && layout === "TITLE_AND_BODY") {
        requests.push({ insertText: { objectId: bodyId, insertionIndex: 0, text: slideBody.trim() } });
      }

      logger.info(`[slides-add-slide] batchUpdate requests=${requests.length}`);
      await execGws(
        `slides presentations batchUpdate --params '${JSON.stringify({ presentationId })}' --json '${JSON.stringify({ requests })}'`,
        driveToken()
      );

      const link = `https://docs.google.com/presentation/d/${presentationId}/edit`;
      closeWidget(link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[slides-add-slide] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="Add Slide" iconBundleId="com.google.drivefs" />;

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <Action.SubmitForm
            title={isLoading ? "Adding…" : "Add Slide"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!presentationId}
          />
        </ActionPanel>
      }
    >
      {presentationsError && <Paper markdown={`**Error loading presentations:** ${presentationsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="presentationId" label="Presentation" value={presentationId} onChange={setPresentationId}>
        {isLoadingPresentations
          ? [<Form.Dropdown.Item key="loading" title="Loading presentations…" value="" />]
          : presentations.map((p) => (
              <Form.Dropdown.Item key={p.id} title={p.name} value={p.id} />
            ))}
      </Form.Dropdown>
      <Form.Dropdown name="layout" label="Layout" value={layout} onChange={setLayout}>
        <Form.Dropdown.Item key="tab" title="Title and Body" value="TITLE_AND_BODY" />
        <Form.Dropdown.Item key="to" title="Title Only" value="TITLE_ONLY" />
        <Form.Dropdown.Item key="blank" title="Blank" value="BLANK" />
      </Form.Dropdown>
      <Form.TextField name="slideTitle" label="Slide Title (optional)" value={slideTitle} onChange={setSlideTitle} />
      <Form.TextField name="slideBody" label="Slide Body (optional)" value={slideBody} onChange={setSlideBody} />
    </Form>
  );
}

const SlidesAddSlideWidget = defineWidget({
  name: "slides-add-slide",
  description: "Add a new slide to an existing Google Slides presentation with optional title, body, and layout",
  schema,
  component: SlidesAddSlide,
});

export default SlidesAddSlideWidget;
