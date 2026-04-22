import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
  runScript,
} from "@eney/api";

const STICKIES_BUNDLE_ID = "com.apple.Stickies";

const schema = z.object({});
type Props = z.infer<typeof schema>;

type NoteColor = "yellow" | "blue" | "green" | "pink" | "purple" | "gray";

// RGB color values for Stickies (0–65535 scale) used via direct AppleScript
const COLOR_RGB: Record<NoteColor, string> = {
  yellow: "{65535, 65535, 26214}",
  blue:   "{39321, 52428, 65535}",
  green:  "{39321, 65535, 39321}",
  pink:   "{65535, 39321, 52428}",
  purple: "{52428, 39321, 65535}",
  gray:   "{52428, 52428, 52428}",
};

function escapeForAppleScript(text: string): string {
  return text
    .split("\n")
    .map((line) => '"' + line.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')
    .join(" & return & ");
}

async function createStickyNote(text: string, _colorRgb: string, colorMenuName: string): Promise<string> {
  const script = `
set noteText to ${escapeForAppleScript(text)}
set stickiesWasRunning to application "Stickies" is running

-- Put text on clipboard before activating Stickies
set the clipboard to noteText

tell application "Stickies" to activate
delay 1.0

tell application "System Events"
  tell process "Stickies"
    set frontmost to true
    delay 0.3

    if stickiesWasRunning then
      click menu item "New Note" of menu "File" of menu bar 1
      delay 0.8
    else
      delay 0.3
    end if

    try
      click text area 1 of window 1
    end try
    delay 0.3

    keystroke "v" using {command down}
    delay 0.5

    try
      click menu item "${colorMenuName}" of menu "Colour" of menu bar 1
    end try
    delay 0.2
  end tell
end tell

return "ok"
  `;
  return runScript(script);
}

// Color menu names used in the Colour menu.
// Stickies uses UK English spelling ("Grey", "Colour").
const COLOR_MENU_NAME: Record<NoteColor, string> = {
  yellow: "Yellow",
  blue:   "Blue",
  green:  "Green",
  pink:   "Pink",
  purple: "Purple",
  gray:   "Grey",
};

type Stage = "loading" | "ready" | "done" | "error";
type ReadySource = "clipboard-empty" | "user-new";

function CreateStickyNote(_props: Props) {
  const closeWidget = useCloseWidget();
  const [stage, setStage] = useState<Stage>("loading");
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>("yellow");
  const [readySource, setReadySource] = useState<ReadySource>("clipboard-empty");
  const [errorMessage, setErrorMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // Guard against double-mount firing the auto-create twice
  const didAutoCreate = useRef(false);
  // Refs updated synchronously in onChange so handleCreate always reads the
  // latest typed value, regardless of whether React has re-rendered yet.
  const textRef = useRef("");
  const colorRef = useRef<NoteColor>("yellow");

  // On mount: read clipboard then immediately kick off note creation
  useEffect(() => {
    if (didAutoCreate.current) return;
    didAutoCreate.current = true;
    runScript(`return (the clipboard as text)`)
      .then((clipboard: string) => {
        const clipText = clipboard.trim();
        if (!clipText) {
          setReadySource("clipboard-empty");
          setStage("ready");
          return;
        }
        setIsCreating(true);
        return createStickyNote(clipText, COLOR_RGB["yellow"], COLOR_MENU_NAME["yellow"])
          .then(() => { setIsCreating(false); setStage("done"); })
          .catch((e) => {
            setIsCreating(false);
            setErrorMessage(e instanceof Error ? e.message : String(e));
            setStage("error");
          });
      })
      .catch(() => {
        setReadySource("clipboard-empty");
        setStage("ready");
      });
  }, []);

  async function handleCreate() {
    const rawText = textRef.current;
    const currentText = rawText.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const currentColor = colorRef.current;
    if (!currentText || isCreating) return;
    // Do NOT call setStage("creating") here — that re-render causes the eney
    // widget to steal keyboard focus from Stickies, making the paste land in
    // the wrong app. Keep the form mounted and just disable the button.
    setIsCreating(true);
    try {
      await createStickyNote(currentText, COLOR_RGB[currentColor], COLOR_MENU_NAME[currentColor]);
      setStage("done");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setStage("error");
    } finally {
      setIsCreating(false);
    }
  }

  const header = (title: string) => (
    <CardHeader title={title} iconBundleId={STICKIES_BUNDLE_ID} />
  );

  // ── Loading (initial clipboard read) ──────────────────────────────────────
  if (stage === "loading") {
    return (
      <Form header={header("Create Sticky Note")} actions={<ActionPanel />}>
        <Paper markdown="_Reading clipboard..._" />
      </Form>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <Form
        header={header("Sticky Note Created")}
        actions={
          <ActionPanel>
            <Action
              title="Done"
              onAction={() => closeWidget("Sticky note created.")}
              style="primary"
            />
          </ActionPanel>
        }
      >
        <Paper markdown="Your sticky note is now on your desktop!" />
      </Form>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (stage === "error") {
    const hint =
      errorMessage.includes("not allowed assistive access") ||
      errorMessage.includes("System Events")
        ? "\n\nGo to **System Settings → Privacy & Security → Accessibility** and allow the app."
        : "";
    return (
      <Form
        header={header("Create Sticky Note")}
        actions={
          <ActionPanel>
            <Action
              title="Dismiss"
              onAction={() => closeWidget("Failed.")}
              style="primary"
            />
          </ActionPanel>
        }
      >
        <Paper markdown={`**Error:** ${errorMessage}${hint}`} />
      </Form>
    );
  }

  // ── Ready / edit mode ─────────────────────────────────────────────────────
  const readyMessage =
    readySource === "user-new"
      ? "_Type your note below:_"
      : "_Clipboard was empty — type your note below:_";

  return (
    <Form
      header={header("Create Sticky Note")}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Note"
            onSubmit={handleCreate}
            style="primary"
            isDisabled={!text.trim() || isCreating}
            isLoading={isCreating}
          />
        </ActionPanel>
      }
    >
      <Paper markdown={readyMessage} />
      <Form.RichTextEditor
        value={text}
        onChange={(v) => {
          textRef.current = v;   // update synchronously so handleCreate always has latest
          setText(v);            // also update state so isDisabled reflects reality
        }}
        isInitiallyFocused
      />
      <Form.Dropdown
        name="color"
        label="Note Color"
        value={color}
        onChange={(v) => {
          colorRef.current = v as NoteColor;
          setColor(v as NoteColor);
        }}
      >
        <Form.Dropdown.Item value="yellow" title="Yellow" />
        <Form.Dropdown.Item value="blue" title="Blue" />
        <Form.Dropdown.Item value="green" title="Green" />
        <Form.Dropdown.Item value="pink" title="Pink" />
        <Form.Dropdown.Item value="purple" title="Purple" />
        <Form.Dropdown.Item value="gray" title="Gray" />
      </Form.Dropdown>
    </Form>
  );
}

const CreateStickyNoteWidget = defineWidget({
  name: "create-sticky-note",
  description:
    "Create a macOS sticky note on the desktop with text from your clipboard",
  schema,
  component: CreateStickyNote,
});

export default CreateStickyNoteWidget;
