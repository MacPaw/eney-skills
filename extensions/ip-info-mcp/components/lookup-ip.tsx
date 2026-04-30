import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  ip: z.string().optional().describe("The IPv4 or IPv6 address to look up. Leave blank to look up this Mac's public IP."),
});

type Props = z.infer<typeof schema>;

interface IpInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryName: string;
  postal: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  org: string;
  asn: string;
}

interface Raw {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  org?: string;
  asn?: string;
  error?: boolean;
  reason?: string;
}

async function fetchIpInfo(ip: string): Promise<IpInfo> {
  const target = ip.trim() ? encodeURIComponent(ip.trim()) : "";
  const url = target ? `https://ipapi.co/${target}/json/` : "https://ipapi.co/json/";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as Raw;
  if (json.error) throw new Error(json.reason || "Lookup failed.");
  return {
    ip: json.ip ?? "",
    city: json.city ?? "",
    region: json.region ?? "",
    country: json.country ?? "",
    countryName: json.country_name ?? "",
    postal: json.postal ?? "",
    latitude: typeof json.latitude === "number" ? json.latitude : null,
    longitude: typeof json.longitude === "number" ? json.longitude : null,
    timezone: json.timezone ?? "",
    org: json.org ?? "",
    asn: json.asn ?? "",
  };
}

function LookupIp(props: Props) {
  const closeWidget = useCloseWidget();
  const [ip, setIp] = useState(props.ip ?? "");
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setIsLooking(true);
    setError("");
    setInfo(null);
    try {
      setInfo(await fetchIpInfo(ip));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLooking(false);
    }
  }

  function onDone() {
    if (!info) closeWidget("Lookup cancelled.");
    else closeWidget(`${info.ip}: ${[info.city, info.region, info.countryName].filter(Boolean).join(", ")}`);
  }

  const header = <CardHeader title="IP Info" iconBundleId="com.apple.systempreferences" />;

  if (info) {
    const lines: string[] = [];
    lines.push(`### ${info.ip}`);
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    if (info.city || info.region || info.countryName) {
      lines.push(`| **Location** | ${[info.city, info.region, info.countryName].filter(Boolean).join(", ")} |`);
    }
    if (info.postal) lines.push(`| **Postal** | ${info.postal} |`);
    if (info.latitude !== null && info.longitude !== null) {
      lines.push(`| **Coordinates** | ${info.latitude}, ${info.longitude} |`);
    }
    if (info.timezone) lines.push(`| **Timezone** | ${info.timezone} |`);
    if (info.org) lines.push(`| **Org** | ${info.org} |`);
    if (info.asn) lines.push(`| **ASN** | \`${info.asn}\` |`);

    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="New Lookup" onSubmit={() => setInfo(null)} style="secondary" />
            <Action.CopyToClipboard title="Copy IP" content={info.ip} />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={lines.join("\n")} />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLooking ? "Looking up..." : ip.trim() ? "Lookup" : "Lookup my IP"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLooking}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="ip" label="IP (blank = my public IP)" value={ip} onChange={setIp} />
    </Form>
  );
}

const LookupIpWidget = defineWidget({
  name: "lookup-ip",
  description:
    "Look up geolocation and ISP info for an IP address using the ipapi.co API. Leave the IP blank to look up this Mac's public IP.",
  schema,
  component: LookupIp,
});

export default LookupIpWidget;
