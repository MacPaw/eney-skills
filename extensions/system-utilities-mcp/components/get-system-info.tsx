import { useEffect, useState } from "react";
import { Action, ActionPanel, defineWidget, Paper, useCloseWidget } from "@eney/api";
import { spawn } from "node:child_process";

interface SystemInfo {
  productDescription: string | null;
  chip: string;
  memory: string;
  serialNumber: string;
  osVersion: string;
}

async function runCommand(command: string, args: string[]): Promise<string> {
  const process = spawn(command, args);
  return await new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Command exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function extractValue(output: string, key: string): string {
  const line = output.split("\n").find((line) => line.includes(key));
  if (line) {
    return line.trim().replace(`${key}:`, "").trim();
  }

  return "Unknown";
}

async function fetchProductDescription(): Promise<string | null> {
  try {
    const output = await runCommand("ioreg", ["-l"]);
    const match = output.match(/"product-description"\s*=\s*<"([^"]+)">/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchSystemInfo(): Promise<SystemInfo> {
  const [hardware, software, productDescription] = await Promise.all([
    runCommand("system_profiler", ["SPHardwareDataType"]),
    runCommand("system_profiler", ["SPSoftwareDataType"]),
    fetchProductDescription(),
  ]);

  return {
    productDescription: productDescription ?? extractValue(hardware, "Model Name"),
    chip: extractValue(hardware, "Chip"),
    memory: extractValue(hardware, "Memory"),
    serialNumber: extractValue(hardware, "Serial Number (system)"),
    osVersion: extractValue(software, "System Version"),
  };
}

function GetSystemInfo() {
  const closeWidget = useCloseWidget();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function onDone() {
    if (error) {
      closeWidget(`Error: ${error}`);
    } else if (info) {
      closeWidget(
        `System information retrieved: ${info.productDescription}, Chip: ${info.chip}, Memory: ${info.memory}, Serial Number: ${info.serialNumber}, macOS Version: ${info.osVersion}`,
      );
    } else {
      closeWidget("No system information available.");
    }
  }

  useEffect(() => {
    fetchSystemInfo()
      .then(setInfo)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load system information.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <Paper markdown="Loading system information…" />;
  }

  if (error) {
    return (
      <Paper
        markdown={`**Error:** ${error}`}
        actions={
          <ActionPanel>
            <Action.SubmitForm onSubmit={onDone} style="primary" title="Done" />
          </ActionPanel>
        }
      />
    );
  }

  const markdown = `## ${info?.productDescription}

| | |
|---|---|
| **Chip** | ${info?.chip ?? "Unknown"} |
| **Memory** | ${info?.memory ?? "Unknown"} |
| **Serial Number** | ${info?.serialNumber ?? "Unknown"} |
| **macOS** | ${info?.osVersion ?? "Unknown"} |`;

  return (
    <Paper
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.SubmitForm onSubmit={onDone} style="primary" title="Done" />
        </ActionPanel>
      }
    />
  );
}

const GetSystemInfoWidget = defineWidget({
  name: "get-system-info",
  description: "Display detailed information about the system.",
  component: GetSystemInfo,
});

export default GetSystemInfoWidget;
