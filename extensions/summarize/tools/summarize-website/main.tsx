import { useState } from 'react';
import { z } from 'zod';
import OpenAI from 'openai';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Action, ActionPanel, Form, Paper } from '@eney/api';
import config from '../../config.json' with { type: 'json' };

export const props = z.object({
	source: z.string()
		.optional()
		.describe('The website URL to summarize.'),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
	const [source, setSource] = useState(props.source);
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState('');

	async function onSubmit() {
		if (!source) return;
		setLoading(true);
		const content = await fetchContent(source);
		await summarize(content);
		setLoading(false);
	}

	async function fetchContent(url: string) {
		const html = await fetch(url).then((r) => r.text());
		const dom = new JSDOM(html, { url: source });
		const reader = new Readability(dom.window.document);
		const document = reader.parse();
		if (!document) throw Error(`unable to parse content: ${url}`);
		return document.textContent;
	}

	async function summarize(content: string) {
		const client = new OpenAI({
			apiKey: config.OPENAI_KEY,
		});
		const stream = await client.responses.create({
			model: 'gpt-4o',
			stream: true,
			instructions: 'Provide summary of the article',
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
			<Form.TextField name='source' label='Website URL' value={source} onChange={onSourceChange} />
		</Form>
	);
}
