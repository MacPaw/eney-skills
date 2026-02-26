import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  defineWidget,
  Files,
  Form,
  Paper,
  useCloseWidget,
} from "@macpaw/eney-api";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

const schema = z.object({
  value: z
    .string()
    .optional()
    .describe("The text or URL to encode as a QR code."),
});

type Props = z.infer<typeof schema>;

function GenerateQRCode(props: Props) {
  const closeWidget = useCloseWidget();
  const [value, setValue] = useState(props.value ?? "");
  const [resultPath, setResultPath] = useState("");
  const [dataUrl, setDataUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit() {
    if (!value) return;
    setIsLoading(true);

    const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
    const outputPath = join(downloadsDir, `qr-${randomUUID()}.png`);

    await QRCode.toFile(outputPath, value, {
      type: "png",
      width: 512,
      margin: 2,
    });

    const base64 = await QRCode.toDataURL(value, {
      width: 512,
      margin: 2,
    });

    setDataUrl(base64);
    setResultPath(outputPath);
    setIsLoading(false);
  }

  function onDone() {
    closeWidget(`QR code saved to: ${resultPath}`);
  }

  if (resultPath) {
    return (
      <Paper
        markdown={`![QR Code](${dataUrl})`}
        actions={
          <ActionPanel layout="row">
            <Action.ShowInFinder style="secondary" path={resultPath} />
            <Action.SubmitForm onSubmit={onDone} title="Done" style="primary" />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Generate"
            onSubmit={onSubmit}
            isDisabled={!value}
            isLoading={isLoading}
            style="primary"
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        name="value"
        label="Text or URL"
        value={value}
        onChange={setValue}
      />
    </Form>
  );
}

const GenerateQRCodeWidget = defineWidget({
  name: "generate-qr-code",
  description: "Generate a QR code from a text string or URL",
  schema,
  component: GenerateQRCode,
});

export default GenerateQRCodeWidget;
