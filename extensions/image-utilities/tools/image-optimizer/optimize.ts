import sharp from 'sharp';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const optimize = {
	png: async (path: string) => {
		const tempFile = join(tmpdir(), `${randomUUID()}.png`);
		await sharp(path).png({ palette: true }).toFile(tempFile);
		return tempFile;
	},
	jpeg: async (path: string, options: sharp.JpegOptions) => {
		const tempFile = join(tmpdir(), `${randomUUID()}.jpeg`);
		await sharp(path).jpeg(options).toFile(tempFile);
		return tempFile;
	},
};
