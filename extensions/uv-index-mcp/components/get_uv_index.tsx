import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  location: z
    .string()
    .optional()
    .describe("City or location name. Omit to auto-detect from IP."),
});

type Props = z.infer<typeof schema>;

interface UVData {
  locationName: string;
  currentUv: number | null;
  maxUv: number | null;
  maxUvHour: string | null;
  hourly: { time: string; uv: number }[];
}

async function geocode(location: string): Promise<{ name: string; lat: number; lng: number; tz: string }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json() as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      country?: string;
      admin1?: string;
      timezone?: string;
    }>;
  };
  if (!data.results || data.results.length === 0) throw new Error(`Location not found: ${location}`);
  const r = data.results[0];
  return {
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lng: r.longitude,
    tz: r.timezone ?? "auto",
  };
}

async function ipLocation(): Promise<{ name: string; lat: number; lng: number; tz: string }> {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP location failed");
  const data = await res.json() as {
    city?: string;
    region?: string;
    country_name?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  if (!data.latitude || !data.longitude) throw new Error("No coordinates from IP");
  return {
    name: [data.city, data.region, data.country_name].filter(Boolean).join(", "),
    lat: data.latitude,
    lng: data.longitude,
    tz: data.timezone ?? "auto",
  };
}

async function fetchUv(lat: number, lng: number, tz: string, name: string): Promise<UVData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=uv_index&current=uv_index&forecast_days=1&timezone=${encodeURIComponent(tz)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const data = await res.json() as {
    current?: { uv_index?: number };
    hourly?: { time: string[]; uv_index: number[] };
  };
  const hourly: UVData["hourly"] = [];
  if (data.hourly?.time && data.hourly?.uv_index) {
    for (let i = 0; i < data.hourly.time.length; i++) {
      hourly.push({ time: data.hourly.time[i], uv: data.hourly.uv_index[i] });
    }
  }
  let maxUv: number | null = null;
  let maxUvHour: string | null = null;
  for (const h of hourly) {
    if (maxUv === null || h.uv > maxUv) {
      maxUv = h.uv;
      maxUvHour = h.time;
    }
  }
  return {
    locationName: name,
    currentUv: data.current?.uv_index ?? null,
    maxUv,
    maxUvHour,
    hourly,
  };
}

function uvCategory(value: number | null): { label: string; emoji: string; advice: string } {
  if (value === null) return { label: "Unknown", emoji: "❔", advice: "" };
  if (value < 3) return { label: "Low", emoji: "🟢", advice: "Minimal protection needed." };
  if (value < 6) return { label: "Moderate", emoji: "🟡", advice: "Sunscreen + sunglasses if outside for long." };
  if (value < 8) return { label: "High", emoji: "🟠", advice: "Reduce sun exposure 11am–4pm; SPF 30+." };
  if (value < 11) return { label: "Very high", emoji: "🔴", advice: "Avoid sun 11am–4pm; SPF 30+, hat, shade." };
  return { label: "Extreme", emoji: "🟣", advice: "Stay in shade; full protection essential." };
}

function formatHour(time: string): string {
  // Open-Meteo returns ISO strings without seconds, e.g. "2026-04-30T14:00"
  const m = /T(\d{2}):/.exec(time);
  return m ? `${m[1]}:00` : time;
}

function buildMarkdown(d: UVData): string {
  const cur = uvCategory(d.currentUv);
  const peak = uvCategory(d.maxUv);
  const lines: string[] = [];
  lines.push(`### ${cur.emoji} **UV ${d.currentUv?.toFixed(1) ?? "—"}** (${cur.label})`);
  if (cur.advice) lines.push(`_${cur.advice}_`);
  lines.push("");
  lines.push(`📍 ${d.locationName}`);
  if (d.maxUv !== null && d.maxUvHour) {
    lines.push(`📈 **Peak today:** ${d.maxUv.toFixed(1)} (${peak.label}) at ${formatHour(d.maxUvHour)}`);
  }
  if (d.hourly.length > 0) {
    lines.push("");
    lines.push("**Hourly UV today:**");
    lines.push("");
    // Keep just the daytime block (UV ≥ 0.5 ish) — but show all with bars to be honest
    const slimmed = d.hourly.slice(0, 24);
    for (const h of slimmed) {
      const bar = "█".repeat(Math.max(0, Math.min(11, Math.round(h.uv))));
      lines.push(`- \`${formatHour(h.time).padEnd(5)}\` \`${bar}\` ${h.uv.toFixed(1)}`);
    }
  }
  lines.push("");
  lines.push("_Source: Open-Meteo_");
  return lines.join("\n");
}

function UVIndex(props: Props) {
  const closeWidget = useCloseWidget();
  const [data, setData] = useState<UVData | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const loc = props.location ? await geocode(props.location) : await ipLocation();
        if (cancelled) return;
        const uv = await fetchUv(loc.lat, loc.lng, loc.tz, loc.name);
        if (cancelled) return;
        setData(uv);
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

  function onRefresh() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (!data) {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
      return;
    }
    const cur = uvCategory(data.currentUv);
    closeWidget(
      `UV at ${data.locationName}: ${data.currentUv?.toFixed(1) ?? "—"} (${cur.label}). ` +
      (data.maxUv !== null && data.maxUvHour
        ? `Peak today ${data.maxUv.toFixed(1)} at ${formatHour(data.maxUvHour)}.`
        : ""),
    );
  }

  const markdown =
    status === "loading"
      ? "_Fetching UV index…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : data
          ? buildMarkdown(data)
          : "";

  return (
    <Form
      header={<CardHeader title="UV Index" iconBundleId="com.apple.weather" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={onRefresh} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const UVIndexWidget = defineWidget({
  name: "get_uv_index",
  description:
    "Show the current UV index, the day's peak UV with its hour, and an hourly UV breakdown for any location. Sources data from the free Open-Meteo forecast API. Falls back to IP-based location when no city is supplied.",
  schema,
  component: UVIndex,
});

export default UVIndexWidget;
