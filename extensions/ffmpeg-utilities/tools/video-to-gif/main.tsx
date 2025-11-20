// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality
import { z } from "zod";
import { Action, ActionPanel, Files, Form, Paper, useBinary } from "@macpaw/eney-api";
import { randomUUID } from "node:crypto";
import { useState } from "react";
import { join } from "node:path";

const props = z.object({
  source: z
    .string()
    .optional()
    .describe("The path to the video file to convert to GIF."),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
  const [source, setSource] = useState(props.source);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { isLoading: isFFmpegLoading, exec: ffmpeg } = useBinary("ffmpeg");

  async function onSubmit() {
    if (!source) return;
    setIsLoading(true);
    const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
    const fileName = join(downloadsDir, `${randomUUID()}.gif`);
    const { code } = await ffmpeg([
      "-nostdin",
      "-y",
      "-i",
      source,
      "-vf",
      "fps=30,scale=1400:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
      "-loop",
      "0",
      fileName,
    ]);

    if (code !== 0) {
      throw Error(`ffmpeg_error: ${code}`);
    }

    setResult(fileName);
    setIsLoading(false);
  }

  function onSourceChange(path: string) {
    setSource(path);
  }

  if (isFFmpegLoading) {
    return <Paper markdown="FFmpeg is loading..." />;
  }

  const fileActions = (
    <ActionPanel layout="row">
      <Action.ShowInFinder
        style="secondary"
        path={result}
      />
      <Action.Finalize title="Done" />
    </ActionPanel>
  )

  if (result) {
    return (
      <Form actions={fileActions}>
        <Files>
          <Files.Item path={result} $context={true} />
        </Files>
      </Form>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Convert"
            onSubmit={onSubmit}
            isLoading={isLoading}
            isDisabled={!source}
            style="primary"
          />
        </ActionPanel>
      }
    >
      {isLoading && <Paper markdown="Doing my work..." />}
      <Form.FilePicker
        name="source"
        label="Source"
        value={source}
        onChange={onSourceChange}
        accept={['video/*']}
      />
    </Form>
  );
}
