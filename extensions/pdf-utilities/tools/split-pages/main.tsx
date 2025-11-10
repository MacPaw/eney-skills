import { z } from 'zod';
import { useState } from 'react';
import { ColorSpace, Matrix, PDFDocument } from 'mupdf';
import { Action, ActionPanel, Files, Form } from '@macpaw/eney-api';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const props = z.object({
	source: z.string()
		.optional()
		.describe('The path to the PDF file to split into pages.'),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
	const [source, setSource] = useState(props.source);
	const [pages, setPages] = useState<string[]>([]);

	async function onSubmit() {
		if (!source) return;
		const file = await readFile(source);
		const doc = PDFDocument.openDocument(new Uint8Array(file.buffer), 'application/pdf');
		const pageCount = doc.countPages();
		for (let i = 0; i < pageCount; i++) {
			const page = doc.loadPage(i);
			const tmp = join(tmpdir(), `${randomUUID()}.png`);
			const png = page.toPixmap(Matrix.scale(2, 2), ColorSpace.DeviceRGB, false, true).asPNG();
			await writeFile(tmp, Buffer.from(png));
			setPages((prev) => {
				return [...prev, tmp];
			});
		}
	}

	function onSourceChange(path: string) {
		setSource(path);
	}

	const fileActions = (
		<ActionPanel layout="row">
			<Action.ShowInFinder
				style="secondary"
				path={dirname(pages[0])}
			/>
			<Action.Finalize title="Done" />
		</ActionPanel>
	)

	if (pages.length) {
		return (
			<Form actions={fileActions}>
				<Files>
					{pages.map((path) => {
						return <Files.Item key={path} path={path} $context={true} />;
					})}
				</Files>
			</Form>
		);
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title='Split' onSubmit={onSubmit} style="primary" />
				</ActionPanel>
			}
		>
			<Form.FilePicker name='source' value={source} onChange={onSourceChange} />
		</Form>
	);
}
