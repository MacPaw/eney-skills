import { z } from "zod";
import { useState } from "react";
import { Action, ActionPanel, Files, Form, Paper, useBinary, setupTool } from "@macpaw/eney-api";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const props = z.object({
	source: z
		.string()
		.optional()
		.describe("The path to the video file to extract audio from."),
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
		const fileName = join(downloadsDir, `${randomUUID()}.mp3`);
		const { code, stderr } = await ffmpeg([
			"-nostdin",
			"-y",
			"-i",
			source,
			"-q:a",
			"0",
			"-map",
			"a",
			fileName,
		]);

		if (code !== 0) {
			throw Error(`ffmpeg_error: ${stderr}`);
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

	const actions = (
		<ActionPanel>
			<Action.SubmitForm
				title="Extract"
				onSubmit={onSubmit}
				isLoading={isLoading}
				isDisabled={!source}
				style="primary"
			/>
		</ActionPanel>
	);

	return (
		<Form actions={actions}>
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

setupTool(Extension);
