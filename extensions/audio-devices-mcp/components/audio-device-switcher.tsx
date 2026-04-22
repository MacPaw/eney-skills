import { useCallback, useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import { spawn } from "node:child_process";

// ─── Swift scripts ─────────────────────────────────────────────────────────────

const LIST_SCRIPT = `
import CoreAudio
import Foundation

func getDefaultDevice(_ selector: AudioObjectPropertySelector) -> AudioObjectID {
    var id = AudioObjectID(0)
    var size = UInt32(MemoryLayout<AudioObjectID>.size)
    var addr = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: 0)
    AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &id)
    return id
}

let defaultOut = getDefaultDevice(kAudioHardwarePropertyDefaultOutputDevice)
let defaultIn  = getDefaultDevice(kAudioHardwarePropertyDefaultInputDevice)

var listSize = UInt32(0)
var listAddr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: 0)
AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &listAddr, 0, nil, &listSize)

let count = Int(listSize) / MemoryLayout<AudioObjectID>.size
var ids = [AudioObjectID](repeating: 0, count: count)
AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &listAddr, 0, nil, &listSize, &ids)

for id in ids {
    var cfRef: Unmanaged<CFString>? = nil
    var nameAddr = AudioObjectPropertyAddress(mSelector: kAudioObjectPropertyName, mScope: kAudioObjectPropertyScopeGlobal, mElement: 0)
    var nameSize = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    _ = withUnsafeMutablePointer(to: &cfRef) { ptr in
        AudioObjectGetPropertyData(id, &nameAddr, 0, nil, &nameSize, ptr)
    }
    guard let name = cfRef?.takeRetainedValue() as String? else { continue }

    var outSize = UInt32(0)
    var outAddr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams, mScope: kAudioObjectPropertyScopeOutput, mElement: 0)
    AudioObjectGetPropertyDataSize(id, &outAddr, 0, nil, &outSize)

    var inSize = UInt32(0)
    var inAddr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams, mScope: kAudioObjectPropertyScopeInput, mElement: 0)
    AudioObjectGetPropertyDataSize(id, &inAddr, 0, nil, &inSize)

    guard outSize > 0 || inSize > 0 else { continue }

    print("\\(name)|\\(id)|\\(outSize > 0 ? 1 : 0)|\\(inSize > 0 ? 1 : 0)|\\(id == defaultOut ? 1 : 0)|\\(id == defaultIn ? 1 : 0)")
}
`;

const SET_SCRIPT = `
import CoreAudio
import Foundation

guard CommandLine.arguments.count > 2,
      let rawID = UInt32(CommandLine.arguments[1]) else {
    fputs("Invalid arguments\\n", stderr); exit(1)
}

let type = CommandLine.arguments[2]
var deviceID = AudioObjectID(rawID)
let selector = type == "input"
    ? kAudioHardwarePropertyDefaultInputDevice
    : kAudioHardwarePropertyDefaultOutputDevice

var addr = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: 0)
let size = UInt32(MemoryLayout<AudioObjectID>.size)
let result = AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, size, &deviceID)
if result == noErr { print("OK") } else { fputs("Error: \\(result)\\n", stderr); exit(1) }
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AudioDevice {
  id: string;
  name: string;
  isOutput: boolean;
  isInput: boolean;
  isDefaultOutput: boolean;
  isDefaultInput: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function runSwift(source: string, args: string[] = []): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("swift", ["-", ...args]);
    let stdout = "";
    let stderr = "";
    proc.stdin?.write(source);
    proc.stdin?.end();
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code: number | null) => {
      const errors = stderr.split("\n").filter(l => l.includes("error:")).join("\n");
      if (errors) { reject(new Error(errors)); return; }
      if (code !== 0) { reject(new Error(stderr.trim() || `swift exited ${String(code)}`)); return; }
      resolve(stdout.trim());
    });
  });
}

async function listDevices(): Promise<AudioDevice[]> {
  const raw = await runSwift(LIST_SCRIPT);
  return raw.split("\n").filter(Boolean).map(line => {
    const [name, id, isOut, isIn, defOut, defIn] = line.split("|");
    return {
      id,
      name,
      isOutput: isOut === "1",
      isInput: isIn === "1",
      isDefaultOutput: defOut === "1",
      isDefaultInput: defIn === "1",
    };
  });
}

async function setDevice(id: string, type: "output" | "input"): Promise<void> {
  await runSwift(SET_SCRIPT, [id, type]);
}

// ─── Component ─────────────────────────────────────────────────────────────────

function AudioDeviceSwitcher() {
  const closeWidget = useCloseWidget();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [outputId, setOutputId] = useState("");
  const [inputId, setInputId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listDevices();
      setDevices(list);
      const defOut = list.find(d => d.isDefaultOutput);
      const defIn  = list.find(d => d.isDefaultInput);
      if (defOut) setOutputId(defOut.id);
      if (defIn)  setInputId(defIn.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleOutputChange(id: string) {
    setOutputId(id);
    setIsSwitching(true);
    setError(null);
    try {
      await setDevice(id, "output");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleInputChange(id: string) {
    setInputId(id);
    setIsSwitching(true);
    setError(null);
    try {
      await setDevice(id, "input");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSwitching(false);
    }
  }

  const outputDevices = devices.filter(d => d.isOutput);
  const inputDevices  = devices.filter(d => d.isInput);

  return (
    <Form
      header={<CardHeader title="Audio Devices" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title={isLoading ? "Loading..." : "Refresh"}
            onAction={load}
            style="secondary"
            isLoading={isLoading || isSwitching}
          />
          <Action title="Done" onAction={() => closeWidget("Done")} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}

      {outputDevices.length > 0 && <Paper markdown="Speaker" />}
      {outputDevices.length > 0 && (
        <Form.Dropdown
          name="output"
          label="🔊 Speaker"
          value={outputId}
          onChange={(id) => { void handleOutputChange(id); }}
        >
          {outputDevices.map(d => (
            <Form.Dropdown.Item key={d.id} value={d.id} title={d.name} />
          ))}
        </Form.Dropdown>
      )}

      {inputDevices.length > 0 && <Paper markdown="Microphone" />}
      {inputDevices.length > 0 && (
        <Form.Dropdown
          name="input"
          label="🎤 Microphone"
          value={inputId}
          onChange={(id) => { void handleInputChange(id); }}
        >
          {inputDevices.map(d => (
            <Form.Dropdown.Item key={d.id} value={d.id} title={d.name} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}

const AudioDeviceSwitcherWidget = defineWidget({
  name: "audio-device-switcher",
  description: "List and switch macOS audio input and output devices",
  component: AudioDeviceSwitcher,
});

export default AudioDeviceSwitcherWidget;
