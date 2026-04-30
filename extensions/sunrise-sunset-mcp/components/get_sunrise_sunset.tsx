import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  location: z
    .string()
    .optional()
    .describe("City or location name, e.g. 'London', 'New York'. Omit to auto-detect from IP."),
  date: z
    .string()
    .optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
});

type Props = z.infer<typeof schema>;

interface SunTimes {
  locationName: string;
  lat: number;
  lng: number;
  date: string;
  sunrise: string;
  sunset: string;
  solarNoon: string;
  dayLength: string;
  civilTwilightBegin: string;
  civilTwilightEnd: string;
}

function formatUTC(isoString: string, lat: number, lng: number): string {
  // api.sunrise-sunset.org returns UTC times — convert to local display
  const d = new Date(isoString);
  // Estimate timezone offset from longitude (rough but avoids needing a TZ API)
  const offsetHours = Math.round(lng / 15);
  const localMs = d.getTime() + offsetHours * 3600 * 1000;
  const local = new Date(localMs);
  const h = local.getUTCHours().toString().padStart(2, "0");
  const m = local.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDayLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function geocode(location: string): Promise<{ name: string; lat: number; lng: number }> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json() as { results?: Array<{ name: string; latitude: number; longitude: number; country?: string; admin1?: string }> };
  if (!data.results || data.results.length === 0) throw new Error(`Location not found: ${location}`);
  const r = data.results[0];
  const parts = [r.name, r.admin1, r.country].filter(Boolean);
  return { name: parts.join(", "), lat: r.latitude, lng: r.longitude };
}

async function getLocationFromIP(): Promise<{ name: string; lat: number; lng: number }> {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP location failed");
  const data = await res.json() as { city?: string; region?: string; country_name?: string; latitude?: number; longitude?: number };
  const name = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
  if (!data.latitude || !data.longitude) throw new Error("No coordinates from IP");
  return { name, lat: data.latitude, lng: data.longitude };
}

async function fetchSunTimes(lat: number, lng: number, date: string, locationName: string): Promise<SunTimes> {
  const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sunrise API failed: ${res.status}`);
  const data = await res.json() as {
    status: string;
    results: {
      sunrise: string;
      sunset: string;
      solar_noon: string;
      day_length: number;
      civil_twilight_begin: string;
      civil_twilight_end: string;
    };
  };
  if (data.status !== "OK") throw new Error(`Sunrise API error: ${data.status}`);
  const r = data.results;
  return {
    locationName,
    lat,
    lng,
    date,
    sunrise: formatUTC(r.sunrise, lat, lng),
    sunset: formatUTC(r.sunset, lat, lng),
    solarNoon: formatUTC(r.solar_noon, lat, lng),
    dayLength: formatDayLength(r.day_length),
    civilTwilightBegin: formatUTC(r.civil_twilight_begin, lat, lng),
    civilTwilightEnd: formatUTC(r.civil_twilight_end, lat, lng),
  };
}

function buildMarkdown(info: SunTimes): string {
  return [
    `### 📍 ${info.locationName}`,
    ``,
    `| | |`,
    `|---|---|`,
    `| 🌅 Sunrise | **${info.sunrise}** |`,
    `| ☀️ Solar noon | **${info.solarNoon}** |`,
    `| 🌇 Sunset | **${info.sunset}** |`,
    `| ⏱ Day length | **${info.dayLength}** |`,
    `| 🌆 Civil twilight begin | ${info.civilTwilightBegin} |`,
    `| 🌆 Civil twilight end | ${info.civilTwilightEnd} |`,
    ``,
    `_Date: ${info.date} · Coords: ${info.lat.toFixed(2)}, ${info.lng.toFixed(2)}_`,
  ].join("\n");
}

function SunriseSunset(props: Props) {
  const closeWidget = useCloseWidget();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [markdown, setMarkdown] = useState("_Fetching sun times…_");
  const [info, setInfo] = useState<SunTimes | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const targetDate = props.date ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loc = props.location
          ? await geocode(props.location)
          : await getLocationFromIP();
        if (cancelled) return;
        const sunInfo = await fetchSunTimes(loc.lat, loc.lng, targetDate, loc.name);
        if (cancelled) return;
        setInfo(sunInfo);
        setMarkdown(buildMarkdown(sunInfo));
        setStatus("done");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setMarkdown(`**Error:** ${msg}`);
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function onDone() {
    if (info) {
      closeWidget(
        `Sunrise/Sunset for ${info.locationName} on ${info.date}: ` +
        `sunrise ${info.sunrise}, solar noon ${info.solarNoon}, sunset ${info.sunset}, ` +
        `day length ${info.dayLength}.`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Dismissed");
    }
  }

  return (
    <Form
      header={<CardHeader title="Sunrise & Sunset" iconBundleId="com.apple.weather" />}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const SunriseSunsetWidget = defineWidget({
  name: "get_sunrise_sunset",
  description:
    "Show sunrise, sunset, solar noon, and day length for any location. Auto-detects location from IP if none is provided.",
  schema,
  component: SunriseSunset,
});

export default SunriseSunsetWidget;
