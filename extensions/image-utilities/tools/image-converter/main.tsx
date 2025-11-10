import { z } from 'zod';
import sharp from 'sharp';
import { useEffect, useState } from 'react';
import { Action, ActionPanel, Files, Form } from '@macpaw/eney-api';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const props = z.object({
	source: z.string()
		.optional()
		.describe('The path to the image file to convert.'),
});

type Props = z.infer<typeof props>;

type ImageFormat = keyof sharp.FormatEnum;

export default function Extension(props: Props) {
	const supported: ImageFormat[] = ['png', 'jpeg', 'webp', 'tiff'];
	const [source, setSource] = useState(props.source);
	const [sourceFormat, setSourceFormat] = useState<ImageFormat | null>(null);
	const [targetFormat, setTargetFormat] = useState<ImageFormat>(supported[0]);
	const [resultPath, setResultPath] = useState('');
	const [loading, setLoading] = useState(false);

	async function onSubmit() {
		if (!source) return;
		setLoading(true);
		const suffix = `.${targetFormat}`;
		const instance = sharp(source);
		const tempFile = join(tmpdir(), `${randomUUID()}${suffix}`);
		await instance.toFormat(targetFormat).toFile(tempFile);
		setLoading(false);
		setResultPath(tempFile);
	}

	function onSourceChange(path: string) {
		setSource(path);
	}

	function onTargetFormatChange(value: string) {
		setTargetFormat(value as ImageFormat);
	}

	useEffect(() => {
		if (!source) return;
		sharp(source).metadata().then(({ format }) => {
			if (!format) return;
			setSourceFormat(format);
			if (format === targetFormat) {
				const filtered = supported.filter((f) => f !== format);
				setTargetFormat(filtered[0]);
			}
		});
	}, [source]);

	const fileActions = (
		<ActionPanel layout="row">
			<Action.ShowInFinder
				style="secondary"
				path={resultPath}
			/>
			<Action.Finalize title="Done" />
		</ActionPanel>
	)

	if (resultPath) {
		return (
			<Form actions={fileActions}>
				<Files>
					<Files.Item path={resultPath} $context={true} />
				</Files>
			</Form>
		);
	}

	return (
		<Form
			actions={
				<ActionPanel>
					<Action.SubmitForm title='Convert' onSubmit={onSubmit} loading={loading} />
				</ActionPanel>
			}
		>
			<Form.FilePicker name='source' label='Source' value={source} onChange={onSourceChange} />
			<Form.Dropdown name='format' value={targetFormat} onChange={onTargetFormatChange} label='Target format'>
				{supported.filter((format) => format !== sourceFormat).map((format) => (
					<Form.Dropdown.Item key={format} title={format ?? ''} value={format} />
				))}
			</Form.Dropdown>
		</Form>
	);
}
