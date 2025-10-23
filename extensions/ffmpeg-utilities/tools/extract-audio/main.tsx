import { z } from "zod";
import { useState } from "react";
import { Action, ActionPanel, Files, Form, Paper, useBinary } from "@macpaw/eney-api";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const props = z.object({
	source: z
		.string()
		.optional()
		.describe("The path to the video file to extract audio from."),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
	const [source, setSource] = useState(props.source);
	const [result, setResult] = useState("");
	const [loading, setLoading] = useState(false);

	const { isLoading: isFFmpegLoading, exec: ffmpeg } = useBinary("ffmpeg");

	async function onSubmit() {
		if (!source) return;
		setLoading(true);
		const tmp = join(tmpdir(), `${randomUUID()}.mp3`);
		const { code, stderr } = await ffmpeg([
			"-nostdin",
			"-y",
			"-i",
			source,
			"-q:a",
			"0",
			"-map",
			"a",
			tmp,
		]);

		if (code !== 0) {
			throw Error(`ffmpeg_error: ${stderr}`);
		}

		setResult(tmp);
		setLoading(false);
	}

	function onSourceChange(path: string) {
		setSource(path);
	}

	if (isFFmpegLoading) {
		return <Paper markdown="FFmpeg is loading..." />;
	}

	if (result) {
		return (
			<Files>
				<Files.Item path={result} />
			</Files>
		);
	}

	const actions = (
		<ActionPanel>
			<Action.SubmitForm
				title="Extract"
				onSubmit={onSubmit}
				loading={loading}
			/>
		</ActionPanel>
	);

	return (
		<Form actions={actions}>
			{loading && <Paper markdown="Doing my work..." />}
			<Form.FilePicker
				name="source"
				label="Source"
				value={source}
				onChange={onSourceChange}
			/>
		</Form>
	);
}
