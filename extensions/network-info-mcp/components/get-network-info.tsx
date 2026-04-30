import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { LocalAddress, getLocalAddresses, getPublicIP, getWifiSSID } from "../helpers/network.js";

const schema = z.object({});

type Props = z.infer<typeof schema>;

interface NetworkInfo {
  local: LocalAddress[];
  ssid: string | null;
  publicIP: string | null;
}

function renderInfo(info: NetworkInfo): string {
  const lines: string[] = [];

  lines.push("### Wi-Fi");
  lines.push(info.ssid ? `\`${info.ssid}\`` : "_Not connected (or Location Services denied)_");

  lines.push("");
  lines.push("### Public IP");
  lines.push(info.publicIP ? `\`${info.publicIP}\`` : "_Unavailable_");

  lines.push("");
  lines.push("### Local addresses");
  if (!info.local.length) {
    lines.push("_None._");
  } else {
    for (const a of info.local) {
      lines.push(`- **${a.iface}** (${a.family}) — \`${a.address}\``);
    }
  }
  return lines.join("\n");
}

function GetNetworkInfo(_props: Props) {
  const closeWidget = useCloseWidget();
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const local = getLocalAddresses();
      const [ssid, publicIP] = await Promise.all([getWifiSSID(), getPublicIP()]);
      setInfo({ local, ssid, publicIP });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onDone() {
    if (!info) {
      closeWidget("Network info unavailable.");
      return;
    }
    const summary = [
      info.ssid ? `Wi-Fi: ${info.ssid}` : null,
      info.publicIP ? `Public: ${info.publicIP}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    closeWidget(summary || "Network info loaded.");
  }

  const header = <CardHeader title="Network Info" iconBundleId="com.apple.systempreferences" />;

  if (isLoading || !info) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown={error ? `**Error:** ${error}` : "Loading network info..."} />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={load} style="secondary" />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={renderInfo(info)} />
    </Form>
  );
}

const GetNetworkInfoWidget = defineWidget({
  name: "get-network-info",
  description: "Show local IPs, Wi-Fi SSID, and the public IP address of this Mac.",
  schema,
  component: GetNetworkInfo,
});

export default GetNetworkInfoWidget;
