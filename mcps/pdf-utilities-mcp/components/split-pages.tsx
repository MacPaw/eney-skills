import { z } from "zod";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  Action,
  ActionPanel,
  defineWidget,
  Files,
  Form,
  useCloseWidget,
} from "@eney/api";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const props = z.object({
  source: z
    .string()
    .optional()
    .describe("The path to the PDF file to split into pages."),
});

type Props = z.infer<typeof props>;

function SplitPages(props: Props) {
  const closeWidget = useCloseWidget();
  const [source, setSource] = useState(props.source);
  const [pages, setPages] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState<string>("");

  async function onSubmit() {
    if (!source) return;
    const file = await readFile(source);
    const doc = await PDFDocument.load(file);

    const downloadsDir = join(process.env.HOME ?? "~", "Downloads");
    const outputPath = join(downloadsDir, `${randomUUID()}`);
    await mkdir(outputPath, { recursive: true });

    setOutputFolder(outputPath);

    const pageCount = doc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      // Create a new PDF document for each page
      const newDoc = await PDFDocument.create();
      const [copiedPage] = await newDoc.copyPages(doc, [i]);
      newDoc.addPage(copiedPage);

      // Save the single-page PDF
      const pdfBytes = await newDoc.save();
      const outputFilename = join(outputPath, `page_${i + 1}.pdf`);
      await writeFile(outputFilename, pdfBytes);

      setPages((prev) => {
        return [...prev, outputFilename];
      });
    }
  }

  function onSourceChange(path: string) {
    setSource(path);
  }

  function onDone() {
    closeWidget(`Pages saved to: ${outputFolder}`);
  }

  const fileActions = (
    <ActionPanel layout="row">
      <Action.ShowInFinder style="secondary" path={outputFolder} />
      <Action.SubmitForm onSubmit={onDone} title="Done" style="primary" />
    </ActionPanel>
  );

  if (pages.length) {
    return (
      <Form actions={fileActions}>
        <Files>
          {pages.map((path) => {
            return <Files.Item key={path} path={path} />;
          })}
        </Files>
      </Form>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Split"
            onSubmit={onSubmit}
            isDisabled={!source}
            style="primary"
          />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        name="source"
        value={source}
        onChange={onSourceChange}
        accept={["application/pdf"]}
      />
    </Form>
  );
}

const SplitPagesWidget = defineWidget({
  name: "split-pages",
  description: "Split a PDF document into individual pages.",
  schema: props,
  component: SplitPages,
});

export default SplitPagesWidget;
