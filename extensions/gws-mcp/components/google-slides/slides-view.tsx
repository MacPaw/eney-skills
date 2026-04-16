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
import { execGws, slidesToken } from "../../helpers/gws.js";
import { useSlidesFiles } from "../../helpers/use-slides-files.js";

const schema = z.object({
  presentationId: z.string().optional().describe("ID of the Google Slides presentation to view."),
});

type Props = z.infer<typeof schema>;

interface TextElement {
  textRun?: { content?: string };
}

interface Shape {
  placeholder?: { type: string };
  text?: { textElements?: TextElement[] };
}

interface PageElement {
  objectId: string;
  shape?: Shape;
}

interface Slide {
  objectId: string;
  pageElements?: PageElement[];
}

interface PresentationData {
  presentationId?: string;
  title?: string;
  slides?: Slide[];
}

function extractShapeText(shape: Shape | undefined): string {
  if (!shape?.text) return "";
  return (shape.text.textElements ?? [])
    .map(te => te.textRun?.content ?? "")
    .join("")
    .replace(/\n$/, "")
    .trim();
}

function getSlideTitle(slide: Slide): string {
  const el = (slide.pageElements ?? []).find(
    e =>
      e.shape?.placeholder?.type === "CENTERED_TITLE" ||
      e.shape?.placeholder?.type === "TITLE"
  );
  return extractShapeText(el?.shape) || "(no title)";
}

function SlidesView(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const { presentations, isLoading: isLoadingPresentations, error: presentationsError } = useSlidesFiles();
  const [presentationId, setPresentationId] = useState(props.presentationId ?? "");
  const [result, setResult] = useState("");
  const [resultLink, setResultLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!presentationId) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[slides-view] presentationId=${presentationId}`);
      const stdout = await execGws(
        `slides presentations get --params '${JSON.stringify({ presentationId })}'`,
        slidesToken()
      );
      const data = JSON.parse(stdout) as PresentationData;
      const slides = data.slides ?? [];
      const link = `https://docs.google.com/presentation/d/${presentationId}/edit`;
      setResultLink(link);

      const rows = slides
        .map((s, i) => `| ${i + 1} | ${getSlideTitle(s)} |`)
        .join("\n");
      setResult(
        `## ${data.title ?? "Untitled"}\n\n**${slides.length} slide${slides.length !== 1 ? "s" : ""}**\n\n| # | Title |\n|---|-------|\n${rows}`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[slides-view] error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const header = <CardHeader title="View Presentation" iconBundleId="com.google.drivefs" />;

  if (result) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Divider />
            <Action title="Done" onAction={() => closeWidget(resultLink)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} isScrollable />
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
            title={isLoading ? "Loading…" : "View Presentation"}
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
    </Form>
  );
}

const SlidesViewWidget = defineWidget({
  name: "slides-view",
  description: "View a Google Slides presentation: title, slide count, and slide titles",
  schema,
  component: SlidesView,
});

export default SlidesViewWidget;
