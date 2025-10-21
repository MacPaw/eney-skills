import { useState } from 'react';
import { z } from 'zod';
import OpenAI from 'openai';	
import { Action, ActionPanel, Form, Paper, ytdlp } from '@macpaw/eney-api';
import config from '../../config.json' with { type: 'json' };

const props = z.object({
	source: z.string()
		.optional()
		.describe('The YouTube URL to summarize.'),
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

export default function Extension(props: Props) {
	const [source, setSource] = useState(props.source);
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState('');

	async function onSubmit() {
		if (!source) return;
		setLoading(true);
		const subtitles = await fetchSubtitles(source);
		await summarize(subtitles);
		setLoading(false);
	}

	async function fetchSubtitles(source: string) {
		const { stdout, stderr, code } = await ytdlp([
			'--skip-download',
			'--dump-json',
			source
		]);

		if (code !== 0) {
			throw Error(`ytdlp_error: ${stderr}`);
		}

		const metadata: MetaData = JSON.parse(stdout);

		const subtitles = metadata.subtitles.en ?? metadata.automatic_captions.en;
		if (!subtitles) {
			throw Error('no_english_subtitles');
		}

		const subtitlesUrl = subtitles.find((item) => item.ext === 'json3')?.url;
		if (!subtitlesUrl) {
			throw Error('no_subtitles_url');
		}

		const response = await fetch(subtitlesUrl);
		if (!response.ok) {
			console.error(subtitlesUrl);
			throw Error('subtitles_bad_response');
		}

		const content: SubtitlesJSON3 = await response.json();
		const lines = [
			`[TITLE]:${metadata.title}`,
			`[DESCRIPTION]:${metadata.title}`,
		];

		for (const event of content.events) {
			if (!Array.isArray(event.segs)) continue;
			const line = event.segs.filter((seg) => seg.utf8).map((seg) => seg.utf8).join('').trim();
			if (line) lines.push(line);
		}

		return lines.join('\n');
	}

	async function summarize(content: string) {
		const client = new OpenAI({
			apiKey: config.OPENAI_KEY,
		});
		const stream = await client.responses.create({
			model: 'gpt-4o',
			stream: true,
			instructions: [
				'Provide detailed summary of the video',
				'Use first two lines metadata marked as [TITLE] and [DESCRIPTION] as hint, but DO NOT include this content into summary',
			].join('\n'),
			input: content,
		});
		for await (const event of stream) {
			if (event.type !== 'response.output_text.delta') continue;
			setResult((prev) => prev += event.delta);
		}
	}

	function onSourceChange(path: string) {
		setSource(path);
	}

	if (result) {
		return <Paper markdown={result} />;
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title='Summarize' onSubmit={onSubmit} loading={loading} />
				</ActionPanel>
			}
		>
			<Form.TextField name='source' label='Source' value={source} onChange={onSourceChange} />
		</Form>
	);
}
