import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  mac: z
    .string()
    .describe("MAC address or OUI prefix, e.g. '04:CF:8C:AC:90:6F', '04-CF-8C', or '04CF8C'."),
});

type Props = z.infer<typeof schema>;

interface MacInfo {
  raw: string;
  oui: string; // first 6 hex chars
  formatted: string; // colon-separated, uppercase
  vendor: string;
  isMulticast: boolean;
  isLocallyAdministered: boolean;
}

function normalizeMac(input: string): { hex: string; oui: string; formatted: string } {
  const hex = input.trim().replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length < 6) {
    throw new Error("Need at least 6 hex digits (24-bit OUI).");
  }
  if (hex.length > 12) {
    throw new Error("MAC address has at most 12 hex digits.");
  }
  // Pair into octets
  const padded = hex.padEnd(12, "0").slice(0, 12);
  const octets: string[] = [];
  for (let i = 0; i < padded.length; i += 2) octets.push(padded.slice(i, i + 2));
  const formatted = octets.join(":");
  return { hex, oui: hex.slice(0, 6), formatted };
}

async function fetchVendor(macOrOui: string): Promise<string> {
  const res = await fetch(`https://api.macvendors.com/${encodeURIComponent(macOrOui)}`);
  if (res.status === 404) return "Unknown / unassigned";
  if (res.status === 429) return "Rate-limited — try again later";
  if (!res.ok) throw new Error(`macvendors.com error ${res.status}`);
  const text = await res.text();
  return text.trim() || "Unknown";
}

function analyzeBits(formatted: string): { isMulticast: boolean; isLocallyAdministered: boolean } {
  // First octet of MAC — bit 0 (LSB) = multicast, bit 1 = locally administered
  const firstOctet = parseInt(formatted.slice(0, 2), 16);
  return {
    isMulticast: (firstOctet & 0x01) === 0x01,
    isLocallyAdministered: (firstOctet & 0x02) === 0x02,
  };
}

function buildMarkdown(info: MacInfo): string {
  return [
    `### \`${info.formatted}\``,
    "",
    `**Vendor:** ${info.vendor}`,
    "",
    `| | |`,
    `|---|---|`,
    `| OUI | \`${info.oui}\` |`,
    `| Multicast bit | ${info.isMulticast ? "✅ multicast/group" : "unicast" } |`,
    `| LAA bit | ${info.isLocallyAdministered ? "✅ locally administered (e.g. virtual / privacy)" : "globally unique (vendor-assigned)"} |`,
    "",
    `_Source: macvendors.com_`,
  ].join("\n");
}

function MacVendor(props: Props) {
  const closeWidget = useCloseWidget();
  const [mac, setMac] = useState(props.mac);
  const [info, setInfo] = useState<MacInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const { hex, oui, formatted } = normalizeMac(mac);
        const vendor = await fetchVendor(hex);
        if (cancelled) return;
        const bits = analyzeBits(formatted);
        setInfo({
          raw: mac,
          oui,
          formatted,
          vendor,
          ...bits,
        });
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (info) {
      closeWidget(
        `${info.formatted} — ${info.vendor}. ` +
        `${info.isMulticast ? "Multicast" : "Unicast"}, ` +
        `${info.isLocallyAdministered ? "locally administered" : "globally unique"}.`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Looking up vendor…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : info
          ? buildMarkdown(info)
          : "";

  return (
    <Form
      header={<CardHeader title="MAC Vendor" iconBundleId="com.apple.AirPort.AirPortUtility" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="mac"
        label="MAC address or OUI"
        value={mac}
        onChange={setMac}
      />
    </Form>
  );
}

const MacVendorWidget = defineWidget({
  name: "lookup_mac_vendor",
  description:
    "Look up the manufacturer of a MAC address (OUI prefix) via macvendors.com. Accepts colons, hyphens, or no separators. Reports the multicast / locally-administered bits to help spot virtualised or randomised MACs.",
  schema,
  component: MacVendor,
});

export default MacVendorWidget;
