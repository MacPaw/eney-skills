import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, CardHeader, defineWidget, useCloseWidget } from "@eney/api";
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";

// Python script uses Quartz CGEventTap to suppress keyboard events at the session level.
// Requires Accessibility permission for the process running Eney.
const BLOCKER_SCRIPT = `import os,sys,signal
try:
    import Quartz
except ImportError:
    sys.exit(1)
def noop(p,t,e,r):return None
mask=(Quartz.CGEventMaskBit(Quartz.kCGEventKeyDown)|
      Quartz.CGEventMaskBit(Quartz.kCGEventKeyUp)|
      Quartz.CGEventMaskBit(Quartz.kCGEventFlagsChanged))
tap=Quartz.CGEventTapCreate(
    Quartz.kCGSessionEventTap,Quartz.kCGHeadInsertEventTap,
    Quartz.kCGEventTapOptionDefault,mask,noop,None)
if tap is None:sys.exit(1)
src=Quartz.CFMachPortCreateRunLoopSource(None,tap,0)
Quartz.CFRunLoopAddSource(Quartz.CFRunLoopGetMain(),src,Quartz.kCFRunLoopCommonModes)
Quartz.CGEventTapEnable(tap,True)
def stop(s,f):Quartz.CGEventTapEnable(tap,False);sys.exit(0)
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
Quartz.CFRunLoopRun()
`;

let blockerProc: ChildProcess | null = null;

function startBlocker(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      writeFileSync("/tmp/eney-kb-clean.py", BLOCKER_SCRIPT);
    } catch {
      reject(new Error("Failed to write helper script to /tmp"));
      return;
    }

    const proc = spawn("/usr/bin/python3", ["/tmp/eney-kb-clean.py"]);
    blockerProc = proc;

    proc.on("error", (e) => {
      blockerProc = null;
      reject(new Error(`Could not start python3: ${e.message}`));
    });

    let exited = false;
    proc.on("exit", () => {
      exited = true;
      blockerProc = null;
    });

    // Give the process 400ms to start. If it exits before that, the tap failed.
    setTimeout(() => {
      if (!exited) {
        resolve();
      } else {
        reject(
          new Error(
            "Keyboard lock failed. Please grant Accessibility permission to Eney in System Settings → Privacy & Security → Accessibility, then try again.",
          ),
        );
      }
    }, 400);
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
type Status = "idle" | "locked" | "done" | "error";

function CleanKeyboard(props: Props) {
  const closeWidget = useCloseWidget();
  const [status, setStatus] = useState<Status>("idle");
  const [isLocking, setIsLocking] = useState(false);
  const [duration, setDuration] = useState<number | null>(props.duration ?? 30);
  const [timeLeft, setTimeLeft] = useState<number>(props.duration ?? 30);
  const [error, setError] = useState("");

  const lockDuration = duration ?? 30;

  // Unmount cleanup — always unlock on widget close
  useEffect(() => {
    return () => stopBlocker();
  }, []);

  // Countdown tick
  useEffect(() => {
    if (status !== "locked") return;
    if (timeLeft <= 0) {
      stopBlocker();
      setStatus("done");
      return;
    }
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [status, timeLeft]);

  async function onLock() {
    if (isLocking) return;
    setIsLocking(true);
    setTimeLeft(lockDuration);
    try {
      await startBlocker();
      setStatus("locked");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    } finally {
      setIsLocking(false);
    }
  }

  function onUnlock() {
    stopBlocker();
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

  if (status === "idle") {
    return (
      <Form
        header={<CardHeader title="Keyboard Cleaner" iconBundleId="com.apple.systempreferences" />}
        actions={
          <ActionPanel>
            <Action
              title={isLocking ? "Locking..." : "Lock Keyboard"}
              onAction={onLock}
              style="primary"
              isLoading={isLocking}
              isDisabled={isLocking}
            />
          </ActionPanel>
        }
      >
        <Paper markdown="Lock your keyboard for safe cleaning. All key input will be blocked until the timer expires or you click Unlock." />
        <Form.NumberField
          name="duration"
          label="Duration (seconds)"
          value={duration}
          onChange={(v) => {
            setDuration(v);
            setTimeLeft(v ?? 30);
          }}
          min={5}
          max={300}
        />
      </Form>
    );
  }

  if (status === "locked") {
    const elapsed = lockDuration - timeLeft;
    const pct = Math.round((elapsed / lockDuration) * 20);
    const bar = "▓".repeat(pct) + "░".repeat(20 - pct);
    return (
      <Form
        header={<CardHeader title="Keyboard Cleaner" iconBundleId="com.apple.systempreferences" />}
        actions={
          <ActionPanel>
            <Action title="Unlock" onAction={onUnlock} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper
          markdown={`**Keyboard locked** — safe to clean\n\n\`${bar}\`\n\n**${timeLeft}** seconds remaining`}
        />
      </Form>
    );
  }

  if (status === "done") {
    return (
      <Form
        header={<CardHeader title="Keyboard Cleaner" iconBundleId="com.apple.systempreferences" />}
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

  // error state
  return (
    <Form
      header={<CardHeader title="Keyboard Cleaner" iconBundleId="com.apple.systempreferences" />}
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
