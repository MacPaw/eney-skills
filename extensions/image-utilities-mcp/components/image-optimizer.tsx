import { z } from "zod";
import sharp from "sharp";
import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  defineWidget,
  Files,
  Form,
  useCloseWidget,
} from "@eney/api";
import { optimize } from "../helpers/optimize.js";
import { JPEGOptions } from "./jpeg-options.js";

export const props = z.object({
  source: z
    .string()
    .optional()
    .describe("The path to the image file to optimize."),
});

type Props = z.infer<typeof props>;

type ImageFormat = keyof sharp.FormatEnum;

export function ImageOptimizer(props: Props) {
  const closeWidget = useCloseWidget();
  const [source, setSource] = useState(props.source);
  const [result, setResult] = useState("");
  const [options, setOptions] = useState({});
  const [sourceFormat, setSourceFormat] = useState<ImageFormat | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit() {
    if (!source) return;
    setIsLoading(true);
    if (sourceFormat === "jpeg") {
      setResult(await optimize.jpeg(source, options));
    }
    if (sourceFormat === "png") {
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

  function onDone() {
    closeWidget(`Optimized image saved to: ${result}`);
  }

  useEffect(() => {
    if (!source) return;
    sharp(source)
      .metadata()
      .then((meta) => {
        if (!meta.format) return;
        setSourceFormat(meta.format);
      });
  }, [source]);

  const fileActions = (
    <ActionPanel layout="row">
      <Action.ShowInFinder style="secondary" path={result} />
      <Action.SubmitForm onSubmit={onDone} title="Done" style="primary" />
    </ActionPanel>
  );

  if (result) {
    return (
      <Form actions={fileActions}>
        <Files>
          <Files.Item path={result} />
        </Files>
      </Form>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Optimize"
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
        accept={["image/*"]}
        label="Source"
        value={source}
        onChange={onSourceChange}
      />
      {source && sourceFormat === "jpeg" && (
        <JPEGOptions source={source} onChange={onOptionsChange} />
      )}
    </Form>
  );
}

const ImageOptimizerWidget = defineWidget({
  name: "image-optimizer",
  description: "Optimize images",
  schema: props,
  component: ImageOptimizer,
});

export default ImageOptimizerWidget;
