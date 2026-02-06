import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  defineWidget,
  Form,
  Paper,
  useBinary,
} from "@macpaw/eney-api";

const props = z.object({
  source: z
    .string()
    .optional()
    .describe("The YouTube URL to get subtitles for."),
});

type Props = z.infer<typeof props>;

type MetaData = {
  title: string;
  description: string;
  subtitles: {
    en?: Array<{ ext: string; url: string }>;
  };
  automatic_captions: {
    en?: Array<{ ext: string; url: string }>;
  };
};

type SubtitlesJSON3 = { events: Array<{ segs?: Array<{ utf8?: string }> }> };

function GetVideoSubtitles(props: Props) {
  const [source, setSource] = useState(props.source ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState("");

  const { isLoading: isYtdlpLoading, exec: ytdlp } = useBinary("yt-dlp");

  console.log("props", props);
  console.log({ isYtdlpLoading });
  console.log("source", source);

  async function onSubmit() {
    if (!source.trim()) return;
    setIsLoading(true);
    const subtitles = await fetchSubtitles(source);
    setResult(subtitles);
    setIsLoading(false);
  }

  async function fetchSubtitles(source: string) {
    const { stdout, stderr, code } = await ytdlp([
      "--skip-download",
      "--dump-json",
      source,
    ]);

    if (code !== 0) {
      throw Error(`ytdlp_error: ${stderr}`);
    }

    const metadata: MetaData = JSON.parse(stdout);

    const subtitles = metadata.subtitles.en ?? metadata.automatic_captions.en;
    if (!subtitles) {
      throw Error("no_english_subtitles");
    }

    const subtitlesUrl = subtitles.find((item) => item.ext === "json3")?.url;
    if (!subtitlesUrl) {
      throw Error("no_subtitles_url");
    }

    const response = await fetch(subtitlesUrl);
    if (!response.ok) {
      console.error(subtitlesUrl);
      throw Error("subtitles_bad_response");
    }

    const content: SubtitlesJSON3 = await response.json();
    const lines = [
      `[TITLE]:${metadata.title}`,
      `[DESCRIPTION]:${metadata.title}`,
    ];

    for (const event of content.events) {
      if (!Array.isArray(event.segs)) continue;
      const line = event.segs
        .filter((seg) => seg.utf8)
        .map((seg) => seg.utf8)
        .join("")
        .trim();
      if (line) lines.push(line);
    }

    return lines.join("\n");
  }

  function onSourceChange(path: string) {
    setSource(path);
  }

  if (isYtdlpLoading) {
    return <Paper markdown="Ytdlp is loading..." />;
  }

  const actions = (
    <ActionPanel>
      <Action.Finalize title="Done" />
    </ActionPanel>
  );

  if (result) {
    return (
      <Paper
        markdown={result}
        actions={actions}
        isScrollable={true}
        $context={true}
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Get subtitles"
            style="primary"
            onSubmit={onSubmit}
            isLoading={isLoading}
            isDisabled={!source}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        name="source"
        label="Source"
        value={source}
        onChange={onSourceChange}
      />
    </Form>
  );
}

const GetVideoSubtitlesWidget = defineWidget({
  name: "get-video-subtitles",
  description: "Get subtitles for a YouTube video.",
  schema: props,
  component: GetVideoSubtitles,
});

export default GetVideoSubtitlesWidget;
