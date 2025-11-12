import { z } from 'zod';
import sharp from 'sharp';
import { useEffect, useState } from 'react';
import { Action, ActionPanel, Files, Form } from '@macpaw/eney-api';
import { optimize } from './optimize.ts';
import { JPEGOptions } from './JPEGOptions.tsx';

export const props = z.object({
	source: z.string()
		.optional()
		.describe('The path to the image file to optimize.'),
});

type Props = z.infer<typeof props>;

type ImageFormat = keyof sharp.FormatEnum;

export default function Extension(props: Props) {
	const [source, setSource] = useState(props.source);
	const [result, setResult] = useState('');
	const [options, setOptions] = useState({});
	const [sourceFormat, setSourceFormat] = useState<ImageFormat | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	async function onSubmit() {
		if (!source) return;
		setIsLoading(true);
		if (sourceFormat === 'jpeg') {
			setResult(await optimize.jpeg(source, options));
		}
		if (sourceFormat === 'png') {
			setResult(await optimize.png(source));
		}
		setIsLoading(false);
	}

	function onSourceChange(path: string) {
		setSource(path);
	}

	function onOptionsChange(options: any) {
		setOptions(options);
	}

	useEffect(() => {
		if (!source) return;
		sharp(source).metadata().then((meta) => {
			if (!meta.format) return;
			setSourceFormat(meta.format);
		});
	}, [source]);

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
					<Action.SubmitForm title='Optimize' onSubmit={onSubmit} isLoading={isLoading} style="primary" />
				</ActionPanel>
			}
		>
			<Form.FilePicker name='source' label='Source' value={source} onChange={onSourceChange} />
			{source && sourceFormat === 'jpeg' && <JPEGOptions source={source} onChange={onOptionsChange} />}
		</Form>
	);
}
