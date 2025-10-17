import { z } from 'zod';
import { useState } from 'react';
import { AutoModel, AutoProcessor, RawImage } from '@huggingface/transformers';
import { Action, ActionPanel, Files, Form } from '@eney/api';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const MODEL_ID = 'briaai/RMBG-1.4';

export const props = z.object({
	source: z.string()
		.optional()
		.describe('The path to the image file to remove background from. Supported formats are: JPEG, PNG'),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
	const [source, setSource] = useState(props.source);
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState('');

	async function onSubmit() {
		if (!source) return;
		setLoading(true);
		const model = await AutoModel.from_pretrained(MODEL_ID, {
			dtype: 'q8',
		});
		const processor = await AutoProcessor.from_pretrained(MODEL_ID, {});
		const image = await RawImage.fromURL(source);
		const { pixel_values } = await processor(image);
		const { output } = await model({ input: pixel_values });
		const maskImage = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
		const maskImageData = maskImage.data;
		const imageData = image.rgba();
		for (let i = 0; i < maskImageData.length; ++i) {
			imageData.data[4 * i + 3] = maskImageData[i];
		}
		const tmp = join(tmpdir(), `${randomUUID()}.png`);
		await imageData.save(tmp);
		setLoading(false);
		setResult(tmp);
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
					<Action.SubmitForm title='Remove background' onSubmit={onSubmit} loading={loading} />
				</ActionPanel>
			}
		>
			<Form.FilePicker name='source' value={source} onChange={onSourceChange} />
		</Form>
	);
}
