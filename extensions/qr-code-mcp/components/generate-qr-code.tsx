import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import QRCode from "qrcode";

const schema = z.object({
  text: z.string().optional().describe("The text or URL to encode."),
  errorCorrection: z
    .enum(["L", "M", "Q", "H"])
    .optional()
    .describe("Error correction level: L (~7%), M (~15%), Q (~25%), H (~30%). Defaults to M."),
});

type Props = z.infer<typeof schema>;

type ECLevel = "L" | "M" | "Q" | "H";

async function renderToDataUrl(text: string, errorCorrectionLevel: ECLevel): Promise<string> {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel,
    margin: 2,
    width: 360,
  });
}

function GenerateQrCode(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [errorCorrection, setErrorCorrection] = useState<ECLevel>(props.errorCorrection ?? "M");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!text.trim()) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    setIsRendering(true);
    setError("");
    renderToDataUrl(text, errorCorrection)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [text, errorCorrection]);

  function onDone() {
    if (dataUrl) {
      closeWidget(`Generated QR code for "${text.length > 60 ? text.slice(0, 57) + "..." : text}".`);
    } else {
      closeWidget("No QR code generated.");
    }
  }

  return (
    <Form
      header={<CardHeader title="QR Code" iconBundleId="com.apple.Preview" />}
      actions={
        <ActionPanel layout="row">
          {dataUrl && <Action.CopyToClipboard title="Copy data URL" content={dataUrl} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="text" label="Text or URL" value={text} onChange={setText} />
      <Form.Dropdown
        name="errorCorrection"
        label="Error correction"
        value={errorCorrection}
        onChange={(v) => setErrorCorrection(v as ECLevel)}
      >
        <Form.Dropdown.Item title="L — ~7%" value="L" />
        <Form.Dropdown.Item title="M — ~15%" value="M" />
        <Form.Dropdown.Item title="Q — ~25%" value="Q" />
        <Form.Dropdown.Item title="H — ~30%" value="H" />
      </Form.Dropdown>
      {isRendering && <Paper markdown="Rendering..." />}
      {dataUrl && <Paper markdown={`![QR Code](${dataUrl})`} />}
    </Form>
  );
}

const GenerateQrCodeWidget = defineWidget({
  name: "generate-qr-code",
  description: "Generate a QR code image from text or a URL.",
  schema,
  component: GenerateQrCode,
});

export default GenerateQrCodeWidget;
