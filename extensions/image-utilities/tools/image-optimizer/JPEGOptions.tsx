import sharp from 'sharp';
import { useEffect, useState } from 'react';
import { Form } from '@macpaw/eney-api';

type Props = {
	source: string;
	onChange: (options: any) => void;
};

const Options = [
	{ label: 'Small', quality: 50 },
	{ label: 'Medium', quality: 75 },
	{ label: 'Large', quality: 90 },
];

function optionTitle(label: string, size?: number) {
	if (!size) return label;
	return `${label} ${Math.round(size / 1000)} KB`;
}

export function JPEGOptions(props: Props) {
	const { source, onChange } = props;
	const [quality, setQuality] = useState(Options[1].quality);
	const [sizes, setSizes] = useState<number[]>([]);

	function toBuffer(path: string, quality: number) {
		return sharp(path).withMetadata().jpeg({ quality }).toBuffer({ resolveWithObject: true });
	}

	function onQualityChange(value: string) {
		const quality = Number(value);
		setQuality(quality);
		onChange({
			quality,
		});
	}

	useEffect(() => {
		(async () => {
			const buffers = await Promise.all([
				toBuffer(source, 50),
				toBuffer(source, 75),
				toBuffer(source, 90),
			]);
			setSizes([
				buffers[0].info.size,
				buffers[1].info.size,
				buffers[2].info.size,
			]);
		})();
	}, [props.source]);

	useEffect(() => {
		onChange({
			quality,
		});
	}, []);

	return (
		<Form.Dropdown name='quality' value={String(quality)} onChange={onQualityChange} label='JPEG Compression Level'>
			{Options.map((option, index) => (
				<Form.Dropdown.Item
					key={option.quality}
					value={String(option.quality)}
					title={optionTitle(option.label, sizes[index])}
				/>
			))}
		</Form.Dropdown>
	);
}
