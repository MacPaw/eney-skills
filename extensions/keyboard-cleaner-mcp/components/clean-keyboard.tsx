import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Swift CGEventTap process that blocks all keyboard input at the session level.
// Requires Accessibility permission for Eney in System Settings → Privacy & Security.
const SWIFT_SOURCE = `
import Cocoa

// Prevent App Nap so the blocker stays active when Eney is sent to the background.
let _ = ProcessInfo.processInfo.beginActivity(
  options: [.userInitiated, .latencyCritical],
  reason: "Keyboard Cleaner active"
)

// keyDown/keyUp covers all regular keys + F1-F12.
// flagsChanged covers modifier keys (Shift, Cmd, Opt, Ctrl, Caps Lock).
// Type 14 (NSEventType.systemDefined) covers media/brightness/volume overlay keys.
let mask = CGEventMask(
  (1 << CGEventType.keyDown.rawValue) |
  (1 << CGEventType.keyUp.rawValue) |
  (1 << CGEventType.flagsChanged.rawValue) |
  (1 << 14)
)

let tap = CGEvent.tapCreate(
  tap: .cgSessionEventTap,
  place: .headInsertEventTap,
  options: .defaultTap,
  eventsOfInterest: mask,
  callback: { _, _, _, _ in return nil },
  userInfo: nil
)
guard let tap = tap else {
  fputs("no_accessibility\\n", stderr)
  exit(1)
}
let src = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetMain(), src, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

// macOS silently disables event taps it deems unresponsive — re-enable every 0.5s.
Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
  CGEvent.tapEnable(tap: tap, enable: true)
}

signal(SIGTERM) { _ in exit(0) }
RunLoop.main.run()
`;

const BINARY_PATH = join(homedir(), ".eney", "eney-kb-blocker");
const SOURCE_PATH = "/tmp/eney-kb-blocker.swift";

function binaryExists(): boolean {
  return existsSync(BINARY_PATH);
}

function compile(): void {
  writeFileSync(SOURCE_PATH, SWIFT_SOURCE);
  execFileSync("/usr/bin/swiftc", ["-O", SOURCE_PATH, "-o", BINARY_PATH], { timeout: 60_000 });
}

let blockerProc: ChildProcess | null = null;

function startBlocker(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(BINARY_PATH, []);
    blockerProc = proc;

    let stderr = "";
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (e) => { blockerProc = null; reject(e); });

    let exited = false;
    proc.on("exit", () => { exited = true; blockerProc = null; });

    setTimeout(() => {
      if (!exited) {
        resolve();
      } else {
        reject(new Error(
          stderr.includes("no_accessibility")
            ? "Permission denied. Open System Settings → Privacy & Security → Accessibility and enable Eney, then try again."
            : "Failed to start keyboard blocker."
        ));
      }
    }, 600);
  });
}

function stopBlocker(): void {
  if (blockerProc) {
    blockerProc.kill("SIGTERM");
    blockerProc = null;
  }
}

const schema = z.object({
  duration: z
    .number()
    .optional()
    .describe("Duration in seconds to lock the keyboard for cleaning (default: 30)."),
});

type Props = z.infer<typeof schema>;
type Status = "idle" | "compiling" | "locked" | "done" | "error";

function CleanKeyboard(props: Props) {
  const closeWidget = useCloseWidget();
  const [status, setStatus] = useState<Status>("idle");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [duration, setDuration] = useState<number | null>(props.duration ?? 30);
  const [timeLeft, setTimeLeft] = useState<number>(props.duration ?? 30);
  const [error, setError] = useState("");

  const lockDuration = duration ?? 30;

  // Unmount: always unlock
  useEffect(() => () => stopBlocker(), []);

  // Countdown tick
  useEffect(() => {
    if (status !== "locked") return;
    if (timeLeft <= 0) {
      doUnlock();
      return;
    }
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [status, timeLeft]);

  async function handleLock() {
    try {
      if (!binaryExists()) {
        setStatus("compiling");
        await new Promise<void>((resolve, reject) => {
          try { compile(); resolve(); } catch (e) { reject(e); }
        });
      }
      setTimeLeft(lockDuration);
      await startBlocker();
      setStatus("locked");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function doUnlock() {
    setIsUnlocking(true);
    stopBlocker();
    setIsUnlocking(false);
    setStatus("done");
  }

  function onReset() {
    setError("");
    setTimeLeft(lockDuration);
    setStatus("idle");
  }

  function onDone() {
    closeWidget("Keyboard unlocked. Cleaning complete.");
  }

  const header = <CardHeader title="Keyboard Cleaner" iconBundleId="com.apple.systempreferences" />;

  if (status === "idle") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Lock Keyboard" onAction={handleLock} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown="Lock your keyboard for safe cleaning. All key input will be blocked until the timer expires or you click Unlock." />
        <Form.NumberField
          name="duration"
          label="Duration (seconds)"
          value={duration}
          onChange={(v) => { setDuration(v); setTimeLeft(v ?? 30); }}
          min={5}
          max={3600}
        />
      </Form>
    );
  }

  if (status === "compiling") {
    return (
      <Form header={header} actions={<ActionPanel><Action title="Setting up..." onAction={() => {}} isDisabled /></ActionPanel>}>
        <Paper markdown="**One-time setup:** compiling keyboard blocker (~10 seconds)…" />
      </Form>
    );
  }

  if (status === "locked") {
    const elapsed = lockDuration - timeLeft;
    const filled = Math.round((elapsed / lockDuration) * 20);
    const bar = "▓".repeat(filled) + "░".repeat(20 - filled);
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action
              title={isUnlocking ? "Unlocking..." : "Unlock"}
              onAction={doUnlock}
              style="secondary"
              isLoading={isUnlocking}
              isDisabled={isUnlocking}
            />
          </ActionPanel>
        }
      >
        <Paper markdown={`**Keyboard locked** — safe to clean\n\n\`${bar}\`\n\n**${timeLeft}** seconds remaining`} />
      </Form>
    );
  }

  if (status === "done") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Lock Again" onSubmit={onReset} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown="**Keyboard unlocked.** Your keyboard is ready to use again." />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Try Again" onSubmit={onReset} style="secondary" />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={`**Could not lock keyboard**\n\n${error}`} />
    </Form>
  );
}

const CleanKeyboardWidget = defineWidget({
  name: "clean-keyboard",
  description: "Lock the keyboard for cleaning and unlock it when done",
  schema,
  component: CleanKeyboard,
});

export default CleanKeyboardWidget;
