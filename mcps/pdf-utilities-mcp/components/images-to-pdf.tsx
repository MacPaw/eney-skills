import { z } from "zod";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  Action,
  ActionPanel,
  defineWidget,
  Files,
  Form,
} from "@macpaw/eney-api";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

export const props = z.object({
  images: z
    .array(z.string())
    .optional()
    .describe("Array of image paths to combine into a PDF."),
});

type Props = z.infer<typeof props>;

function ImagesToPdf(props: Props) {
  const [images, setImages] = useState<string[]>(props.images || []);
  const [outputPath, setOutputPath] = useState<string>("");

  async function onSubmit() {
    if (!images || images.length === 0) return;

    const pdfDoc = await PDFDocument.create();

    for (const imagePath of images) {
      try {
        const imageData = await readFile(imagePath);
        const ext = extname(imagePath).toLowerCase();

        // Embed the image based on its type
        let image;
        if (ext === ".png") {
          image = await pdfDoc.embedPng(imageData);
        } else if (ext === ".jpg" || ext === ".jpeg") {
          image = await pdfDoc.embedJpg(imageData);
        } else {
          // Skip unsupported formats
          console.warn(`Skipping unsupported image format: ${imagePath}`);
          continue;
        }

        const { width, height } = image.scale(1);
        const page = pdfDoc.addPage([width, height]);

        page.drawImage(image, {
          x: 0,
          y: 0,
          width,
          height,
        });
      } catch (error) {
        console.error(`Error processing image ${imagePath}:`, error);
        continue;
      }
    }

    const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
    const fileName = join(downloadsDir, `${randomUUID()}.pdf`);
    const pdfBytes = await pdfDoc.save();
    await writeFile(fileName, pdfBytes);

    setOutputPath(fileName);
  }

  function onImageChange(paths: string[]) {
    setImages(paths);
  }

  const fileActions = (
    <ActionPanel layout="row">
      <Action.ShowInFinder style="secondary" path={outputPath} />
      <Action.Finalize title="Done" />
    </ActionPanel>
  );

  if (outputPath) {
    return (
      <Form actions={fileActions}>
        <Files>
          <Files.Item key={outputPath} path={outputPath} $context={true} />
        </Files>
      </Form>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={
              images.length > 0
                ? `Create PDF from ${images.length} image${images.length > 1 ? "s" : ""}`
                : "Create PDF"
            }
            onSubmit={onSubmit}
            isDisabled={images.length === 0}
            style="primary"
          />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        name="images"
        value={images}
        onChange={onImageChange}
        multiple
        accept={["image/png", "image/jpeg"]}
      />
    </Form>
  );
}

const ImageToPdfWidget = defineWidget({
  name: "images-to-pdf",
  description: "Combine multiple images into a single PDF document.",
  schema: props,
  component: ImagesToPdf,
});

export default ImageToPdfWidget;
