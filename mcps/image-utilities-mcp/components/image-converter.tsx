import { z } from "zod";
import sharp, { type WriteableMetadata } from "sharp";
import heicConvert from "heic-convert";
import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  defineWidget,
  Files,
  Form,
} from "@macpaw/eney-api";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const props = z.object({
  source: z
    .string()
    .optional()
    .describe("The path to the image file to convert."),
  format: z
    .enum(["png", "jpeg", "webp", "tiff", "gif"])
    .optional()
    .describe(
      "The desired output format. Supported formats: png, jpeg, webp, tiff, gif.",
    ),
});

type Props = z.infer<typeof props>;

type ImageFormat = keyof sharp.FormatEnum;

const formatLabels: Record<string, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
  tiff: "TIFF",
  gif: "GIF",
};

export function ImageConverter(props: Props) {
  const supported: ImageFormat[] = ["png", "jpeg", "webp", "tiff", "gif"];
  const [source, setSource] = useState(props.source);
  const [sourceFormat, setSourceFormat] = useState<ImageFormat | null>(null);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>(
    props.format ?? supported[0],
  );
  const [resultPath, setResultPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit() {
    if (!source) return;
    setIsLoading(true);
    const suffix = `.${targetFormat}`;
    const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
    const tempFile = join(downloadsDir, `${randomUUID()}${suffix}`);

    const isHeicSource = sourceFormat === "heif";

    let instance: sharp.Sharp;

    if (isHeicSource) {
      try {
        const inputBuffer = await readFile(source);
        const inputUint8Array = new Uint8Array(inputBuffer);
        const outputArrayBuffer = await heicConvert({
          buffer: inputUint8Array as unknown as ArrayBufferLike,
          format: "PNG",
        });
        instance = sharp(Buffer.from(outputArrayBuffer));
      } catch {
        // Fallback: file has .heic extension but isn't valid HEIC (e.g., AVIF)
        instance = sharp(source).keepMetadata();
      }
    } else {
      instance = sharp(source).keepMetadata();
    }

    await instance.toFormat(targetFormat).toFile(tempFile);

    setIsLoading(false);
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
    const ext = source.toLowerCase().split(".").pop();
    if (ext === "heic" || ext === "heif") {
      setSourceFormat("heif");
      return;
    }
    sharp(source)
      .metadata()
      .then(({ format }) => {
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
      <Action.ShowInFinder style="secondary" path={resultPath} />
      <Action.Finalize title="Done" />
    </ActionPanel>
  );

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
          <Action.SubmitForm
            title="Convert"
            onSubmit={onSubmit}
            isDisabled={!source}
            isLoading={isLoading}
            style="primary"
          />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        name="source"
        label="Source"
        value={source}
        onChange={onSourceChange}
        accept={["image/*"]}
      />
      <Form.Dropdown
        name="format"
        value={targetFormat}
        onChange={onTargetFormatChange}
        label="Target format"
      >
        {supported
          .filter((format) => format !== sourceFormat)
          .map((format) => (
            <Form.Dropdown.Item
              key={format}
              title={formatLabels[format] ?? format}
              value={format}
            />
          ))}
      </Form.Dropdown>
    </Form>
  );
}

const ImageConverterWidget = defineWidget({
  name: "image-converter",
  description: "Convert images between formats",
  schema: props,
  component: ImageConverter,
});

export default ImageConverterWidget;
