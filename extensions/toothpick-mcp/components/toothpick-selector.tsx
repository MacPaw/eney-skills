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
import IOBluetooth
import Foundation

let devices = IOBluetoothDevice.pairedDevices() as? [IOBluetoothDevice] ?? []
for device in devices {
    let name = (device.name ?? "Unknown").replacingOccurrences(of: "|", with: "-")
    let addr = device.addressString ?? ""
    let connected = device.isConnected() ? 1 : 0
    print("\\(name)|\\(addr)|\\(connected)")
}
`;

const CONNECT_SCRIPT = `
import IOBluetooth
import Foundation

guard CommandLine.arguments.count > 2,
      !CommandLine.arguments[1].isEmpty else {
    fputs("Invalid arguments\\n", stderr); exit(1)
}
let address = CommandLine.arguments[1]
let action = CommandLine.arguments[2]

guard let device = IOBluetoothDevice(address: address) else {
    fputs("Device not found\\n", stderr); exit(1)
}

let result: IOReturn = action == "disconnect" ? device.closeConnection() : device.openConnection()
if result == kIOReturnSuccess {
    print("OK")
} else {
    fputs("Error code: \\(result)\\n", stderr); exit(1)
}
`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BtDevice {
  name: string;
  address: string;
  isConnected: boolean;
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

async function listDevices(): Promise<BtDevice[]> {
  const raw = await runSwift(LIST_SCRIPT);
  return raw.split("\n").filter(Boolean).map(line => {
    const [name, address, connected] = line.split("|");
    return { name, address, isConnected: connected === "1" };
  });
}

async function connectDevice(address: string, action: "connect" | "disconnect"): Promise<void> {
  await runSwift(CONNECT_SCRIPT, [address, action]);
}

// ─── Component ─────────────────────────────────────────────────────────────────

function ToothpickSelector() {
  const closeWidget = useCloseWidget();
  const [devices, setDevices] = useState<BtDevice[]>([]);
  const [selectedAddr, setSelectedAddr] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listDevices();
      setDevices(list);
      setSelectedAddr(prev => prev || (list.length > 0 ? list[0].address : ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedDevice = devices.find(d => d.address === selectedAddr);
  const isConnected = selectedDevice?.isConnected ?? false;
  const isBusy = isLoading || isConnecting;

  async function handleConnect() {
    if (!selectedAddr) return;
    setIsConnecting(true);
    setError(null);
    try {
      await connectDevice(selectedAddr, "connect");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!selectedAddr) return;
    setIsConnecting(true);
    setError(null);
    try {
      await connectDevice(selectedAddr, "disconnect");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <Form
      header={<CardHeader title="Bluetooth Devices" iconBundleId="com.apple.systempreferences" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title={isLoading ? "Loading..." : "Refresh"}
            onAction={load}
            style="secondary"
            isLoading={isBusy}
          />
          {isConnected ? (
            <Action
              title={isConnecting ? "Disconnecting..." : "Disconnect"}
              onAction={() => { void handleDisconnect(); }}
              style="secondary"
              isLoading={isConnecting}
              isDisabled={!selectedAddr || isLoading}
            />
          ) : (
            <Action
              title={isConnecting ? "Connecting..." : "Connect"}
              onAction={() => { void handleConnect(); }}
              style="primary"
              isLoading={isConnecting}
              isDisabled={!selectedAddr || isLoading}
            />
          )}
          <Action title="Done" onAction={() => closeWidget("Done")} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {devices.length > 0 && (
        <Form.Dropdown
          name="device"
          label="Device"
          value={selectedAddr}
          onChange={setSelectedAddr}
          searchable
        >
          {devices.map(d => (
            <Form.Dropdown.Item
              key={d.address}
              value={d.address}
              title={d.isConnected ? `${d.name} ✓` : d.name}
            />
          ))}
        </Form.Dropdown>
      )}
      {selectedDevice && (
        <Paper markdown={`**Status:** ${isConnected ? "Connected" : "Disconnected"}`} />
      )}
    </Form>
  );
}

const ToothpickSelectorWidget = defineWidget({
  name: "toothpick-selector",
  description: "Fetch the list of paired Bluetooth devices and establish a connection to the chosen one.",
  component: ToothpickSelector,
});

export default ToothpickSelectorWidget;
