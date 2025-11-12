import sharp from 'sharp';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const optimize = {
	png: async (path: string) => {
		const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
		const tempFile = join(downloadsDir, `${randomUUID()}.png`);
		await sharp(path).png({ palette: true }).toFile(tempFile);
		return tempFile;
	},
	jpeg: async (path: string, options: sharp.JpegOptions) => {
		const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
		const tempFile = join(downloadsDir, `${randomUUID()}.jpeg`);
		await sharp(path).jpeg(options).toFile(tempFile);
		return tempFile;
	},
};
