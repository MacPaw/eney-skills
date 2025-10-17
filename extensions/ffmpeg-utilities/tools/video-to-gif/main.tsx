// https://superuser.com/questions/556029/how-do-i-convert-a-video-to-gif-using-ffmpeg-with-reasonable-quality
import { z } from "zod";
import { Action, ActionPanel, ffmpeg, Files, Form, Paper } from "@eney/api";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { useState } from "react";

export const props = z.object({
  source: z
    .string()
    .optional()
    .describe("The path to the video file to convert to GIF."),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
  const [source, setSource] = useState(props.source);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!source) return;
    setLoading(true);
    const tmp = path.join(os.tmpdir(), `${randomUUID()}.gif`);
    const cmd = ffmpeg([
      "-nostdin",
      "-y",
      "-i",
      source,
      "-vf",
      "fps=15,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
      "-loop",
      "0",
      tmp,
    ]);

    cmd.on('exit', (code, signal) => {
      if (code !== 0) {
        throw Error(`ffmpeg_error: ${code}`);
      }

      setResult(tmp);
      setLoading(false);
    });
  }

  function onSourceChange(path: string) {
    setSource(path);
  }

  if (result) {
    return (
      <Files>
        <Files.Item path={result} />
      </Files>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Convert"
            onSubmit={onSubmit}
            loading={loading}
          />
        </ActionPanel>
      }
    >
      {loading && <Paper markdown="Loading..." />}
      <Form.FilePicker
        name="source"
        label="Source"
        value={source}
        onChange={onSourceChange}
      />
    </Form>
  );
}
