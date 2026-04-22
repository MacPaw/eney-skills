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
import { execFile, spawn } from "node:child_process";

// ─── Swift connect script ──────────────────────────────────────────────────────

const CONNECT_SCRIPT = `
import IOBluetooth
import Foundation

guard CommandLine.arguments.count > 2,
      !CommandLine.arguments[1].isEmpty else {
    fputs("Invalid arguments\\n", stderr); exit(1)
}
let addressStr = CommandLine.arguments[1]
let action = CommandLine.arguments[2]

let all = IOBluetoothDevice.pairedDevices() as? [IOBluetoothDevice] ?? []
guard let device = all.first(where: { $0.addressString == addressStr }) else {
    fputs("Device not found: \\(addressStr)\\n", stderr); exit(1)
}

let result: IOReturn = action == "disconnect" ? device.closeConnection() : device.openConnection()
guard result == kIOReturnSuccess else {
    fputs("Error \\(result)\\n", stderr); exit(1)
}

RunLoop.main.run(until: Date(timeIntervalSinceNow: 1.5))
print("OK")
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BtDevice {
  name: string;
  address: string;
  isConnected: boolean;
  type: string;
  battery: string;
}

interface SysProfilerDevice {
  device_address?: string;
  device_minorType?: string;
  device_batteryLevelMain?: string;
  device_batteryLevelLeft?: string;
  device_batteryLevelRight?: string;
}

interface SysProfilerData {
  SPBluetoothDataType: Array<{
    device_connected?: Array<Record<string, SysProfilerDevice>>;
    device_not_connected?: Array<Record<string, SysProfilerDevice>>;
  }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function deviceEmoji(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("headphone") || t.includes("earphone") || t.includes("earbud")) return "🎧";
  if (t.includes("speaker")) return "🔊";
  if (t.includes("keyboard")) return "⌨️";
  if (t.includes("mouse")) return "🖱️";
  if (t.includes("trackpad") || t.includes("track pad")) return "🖱️";
  if (t.includes("phone") || t.includes("mobile")) return "📱";
  if (t.includes("computer") || t.includes("laptop")) return "💻";
  if (t.includes("watch")) return "⌚";
  if (t.includes("gamepad") || t.includes("controller")) return "🎮";
  if (t.includes("car") || t.includes("audio")) return "🎵";
  return "📶";
}

function formatBattery(info: SysProfilerDevice): string {
  if (info.device_batteryLevelLeft && info.device_batteryLevelRight) {
    return `🔋 L: ${info.device_batteryLevelLeft} R: ${info.device_batteryLevelRight}`;
  }
  if (info.device_batteryLevelMain) {
    return `🔋 ${info.device_batteryLevelMain}`;
  }
  return "";
}

function parseDevices(section: SysProfilerData["SPBluetoothDataType"][0]): BtDevice[] {
  const devices: BtDevice[] = [];

  function addEntry(entry: Record<string, SysProfilerDevice>, isConnected: boolean) {
    for (const [name, info] of Object.entries(entry)) {
      if (!info.device_address) continue;
      devices.push({
        name,
        address: info.device_address,
        isConnected,
        type: info.device_minorType ?? "",
        battery: formatBattery(info),
      });
    }
  }

  for (const entry of section.device_connected ?? []) addEntry(entry, true);
  for (const entry of section.device_not_connected ?? []) addEntry(entry, false);
  return devices;
}

function deviceMarkdown(d: BtDevice): string {
  const emoji = d.type ? deviceEmoji(d.type) : "📶";
  const title = `**${emoji} ${d.name}**`;
  return d.battery ? `${title}  ·  ${d.battery}` : title;
}

function runSysProfiler(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("/usr/sbin/system_profiler", ["SPBluetoothDataType", "-json"], (err, stdout, stderr) => {
      if (err) { reject(new Error(stderr || err.message)); return; }
      resolve(stdout);
    });
  });
}

function runSwift(source: string, args: string[]): Promise<void> {
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
      if (stderr.includes("PRIVACY_VIOLATION") || stderr.includes("TCC_CRASHING")) {
        reject(new Error("Bluetooth access denied.\n\nTo fix: **System Settings → Privacy & Security → Bluetooth** → add Eney."));
        return;
      }
      const errors = stderr.split("\n").filter(l => l.includes("error:")).join("\n");
      if (errors) { reject(new Error(errors)); return; }
      if (code !== 0) { reject(new Error(stderr.trim() || stdout.trim() || `swift exited ${String(code)}`)); return; }
      resolve();
    });
  });
}

async function listDevices(): Promise<BtDevice[]> {
  const raw = await runSysProfiler();
  const data = JSON.parse(raw) as SysProfilerData;
  return parseDevices(data.SPBluetoothDataType[0]);
}

function toIOBluetoothAddress(addr: string): string {
  return addr.toLowerCase().replace(/:/g, "-");
}

async function connectDevice(address: string, action: "connect" | "disconnect"): Promise<void> {
  await runSwift(CONNECT_SCRIPT, [toIOBluetoothAddress(address), action]);
}

function openBluetoothSettings() {
  spawn("open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth"]);
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface PendingAction {
  address: string;
  action: "connect" | "disconnect";
}

function ToothpickSelector() {
  const closeWidget = useCloseWidget();
  const [devices, setDevices] = useState<BtDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingAddr, setConnectingAddr] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setDevices(await listDevices());
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(address: string, action: "connect" | "disconnect") {
    setConnectingAddr(address);
    setNeedsPermission(false);
    try {
      await connectDevice(address, action);
      setPending(null);
      setDevices(prev => prev.map(d =>
        d.address === address ? { ...d, isConnected: action === "connect" } : d
      ));
      setTimeout(() => { void load(); }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("PRIVACY_VIOLATION") || msg.includes("TCC_CRASHING") || msg.includes("access denied")) {
        setPending({ address, action });
        setNeedsPermission(true);
      }
    } finally {
      setConnectingAddr(null);
    }
  }

  if (needsPermission) {
    return (
      <Form
        header={<CardHeader title="Bluetooth Permission Required" iconBundleId="com.apple.systempreferences" />}
        actions={
          <ActionPanel layout="row">
            <Action title="Open System Settings" onAction={openBluetoothSettings} style="secondary" />
            <Action
              title="Try Again"
              onAction={() => { if (pending) { void handleAction(pending.address, pending.action); } }}
              style="primary"
            />
          </ActionPanel>
        }
      >
        <Paper markdown={"Eney needs Bluetooth access to connect devices.\n\n1. Click **Open System Settings**\n2. Go to **Privacy & Security → Bluetooth**\n3. Enable access for **Eney**\n4. Click **Try Again**"} />
      </Form>
    );
  }

  const sorted = [...devices].sort((a, b) => Number(b.isConnected) - Number(a.isConnected));

  return (
    <Form
      header={<CardHeader title="Bluetooth Devices" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title={isLoading ? "Loading..." : "Refresh"}
            onAction={load}
            style="secondary"
            isLoading={isLoading}
          />
          <Action title="Done" onAction={() => closeWidget("Done")} style="primary" />
        </ActionPanel>
      }
    >
      {sorted.map(d => (
        <Paper
          key={d.address}
          markdown={deviceMarkdown(d)}
          isScrollable={false}
          actions={
            <ActionPanel>
              <Action
                title={
                  connectingAddr === d.address
                    ? (d.isConnected ? "Disconnecting..." : "Connecting...")
                    : (d.isConnected ? "Disconnect" : "Connect")
                }
                onAction={() => { void handleAction(d.address, d.isConnected ? "disconnect" : "connect"); }}
                isLoading={connectingAddr === d.address}
                isDisabled={isLoading || (connectingAddr !== null && connectingAddr !== d.address)}
                style={d.isConnected ? "secondary" : "primary"}
              />
            </ActionPanel>
          }
        />
      ))}
    </Form>
  );
}

const ToothpickSelectorWidget = defineWidget({
  name: "toothpick-selector",
  description: "Fetch the list of paired Bluetooth devices and establish a connection to the chosen one.",
  component: ToothpickSelector,
});

export default ToothpickSelectorWidget;
