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

interface AQI {
  locationName: string;
  lat: number;
  lng: number;
  usAqi: number | null;
  euAqi: number | null;
  pm10: number | null;
  pm25: number | null;
  co: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  time: string;
}

async function geocode(location: string): Promise<{ name: string; lat: number; lng: number }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json() as { results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }> };
  if (!data.results || data.results.length === 0) throw new Error(`Location not found: ${location}`);
  const r = data.results[0];
  return { name: [r.name, r.admin1, r.country].filter(Boolean).join(", "), lat: r.latitude, lng: r.longitude };
}

async function ipLocation(): Promise<{ name: string; lat: number; lng: number }> {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP location failed");
  const data = await res.json() as { city?: string; region?: string; country_name?: string; latitude?: number; longitude?: number };
  if (!data.latitude || !data.longitude) throw new Error("No coordinates from IP");
  return {
    name: [data.city, data.region, data.country_name].filter(Boolean).join(", "),
    lat: data.latitude,
    lng: data.longitude,
  };
}

async function fetchAQI(lat: number, lng: number, name: string): Promise<AQI> {
  const fields = "us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide";
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=${fields}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Air quality API error ${res.status}`);
  const data = await res.json() as {
    current?: {
      time: string;
      us_aqi?: number;
      european_aqi?: number;
      pm10?: number;
      pm2_5?: number;
      carbon_monoxide?: number;
      nitrogen_dioxide?: number;
      ozone?: number;
      sulphur_dioxide?: number;
    };
  };
  const c = data.current;
  if (!c) throw new Error("No current data returned.");
  return {
    locationName: name,
    lat,
    lng,
    usAqi: c.us_aqi ?? null,
    euAqi: c.european_aqi ?? null,
    pm10: c.pm10 ?? null,
    pm25: c.pm2_5 ?? null,
    co: c.carbon_monoxide ?? null,
    no2: c.nitrogen_dioxide ?? null,
    o3: c.ozone ?? null,
    so2: c.sulphur_dioxide ?? null,
    time: c.time,
  };
}

function usAqiCategory(value: number | null): { label: string; emoji: string } {
  if (value === null) return { label: "Unknown", emoji: "❔" };
  if (value <= 50) return { label: "Good", emoji: "🟢" };
  if (value <= 100) return { label: "Moderate", emoji: "🟡" };
  if (value <= 150) return { label: "Unhealthy for sensitive groups", emoji: "🟠" };
  if (value <= 200) return { label: "Unhealthy", emoji: "🔴" };
  if (value <= 300) return { label: "Very unhealthy", emoji: "🟣" };
  return { label: "Hazardous", emoji: "🟤" };
}

function buildMarkdown(d: AQI): string {
  const cat = usAqiCategory(d.usAqi);
  const lines: string[] = [];
  lines.push(`### ${cat.emoji} ${cat.label}`);
  lines.push(`**US AQI:** ${d.usAqi ?? "—"} · **EU AQI:** ${d.euAqi ?? "—"}`);
  lines.push("");
  lines.push(`📍 ${d.locationName}`);
  lines.push("");
  lines.push("| Pollutant | Value |");
  lines.push("|---|---|");
  lines.push(`| PM2.5 | ${d.pm25 ?? "—"} μg/m³ |`);
  lines.push(`| PM10 | ${d.pm10 ?? "—"} μg/m³ |`);
  lines.push(`| Ozone (O₃) | ${d.o3 ?? "—"} μg/m³ |`);
  lines.push(`| NO₂ | ${d.no2 ?? "—"} μg/m³ |`);
  lines.push(`| SO₂ | ${d.so2 ?? "—"} μg/m³ |`);
  lines.push(`| CO | ${d.co ?? "—"} μg/m³ |`);
  lines.push("");
  lines.push(`_Updated ${d.time} UTC · Open-Meteo Air Quality_`);
  return lines.join("\n");
}

function AirQuality(props: Props) {
  const closeWidget = useCloseWidget();
  const [data, setData] = useState<AQI | null>(null);
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
        const aqi = await fetchAQI(loc.lat, loc.lng, loc.name);
        if (cancelled) return;
        setData(aqi);
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onRefresh() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (!data) {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
      return;
    }
    const cat = usAqiCategory(data.usAqi);
    closeWidget(
      `Air quality at ${data.locationName}: US AQI ${data.usAqi ?? "—"} (${cat.label}), ` +
      `EU AQI ${data.euAqi ?? "—"}. PM2.5 ${data.pm25 ?? "—"} μg/m³, PM10 ${data.pm10 ?? "—"} μg/m³.`,
    );
  }

  const markdown =
    status === "loading"
      ? "_Fetching air quality…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : data
          ? buildMarkdown(data)
          : "";

  return (
    <Form
      header={<CardHeader title="Air Quality" iconBundleId="com.apple.weather" />}
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

const AirQualityWidget = defineWidget({
  name: "get_air_quality",
  description:
    "Show current air quality (US AQI, EU AQI, PM2.5/PM10, O₃, NO₂, SO₂, CO) for a given location, sourced from the free Open-Meteo Air Quality API. Falls back to IP-based location when no city is supplied.",
  schema,
  component: AirQuality,
});

export default AirQualityWidget;
