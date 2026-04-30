import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  units: z
    .enum(["km", "mi"])
    .optional()
    .describe("Display units. 'km' (default) or 'mi'."),
  autoRefresh: z
    .boolean()
    .optional()
    .describe("If true, refresh location every 5 seconds. Defaults to false."),
});

type Props = z.infer<typeof schema>;

interface ISSData {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmh: number;
  visibility: string;
  footprintKm: number;
  timestamp: number;
}

async function fetchISS(): Promise<ISSData> {
  const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544?units=kilometers");
  if (!res.ok) throw new Error(`ISS API error ${res.status}`);
  const data = await res.json() as {
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    visibility: string;
    footprint: number;
    timestamp: number;
  };
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    altitudeKm: data.altitude,
    velocityKmh: data.velocity,
    visibility: data.visibility,
    footprintKm: data.footprint,
    timestamp: data.timestamp,
  };
}

function formatLat(lat: number): string {
  const dir = lat >= 0 ? "N" : "S";
  return `${Math.abs(lat).toFixed(3)}° ${dir}`;
}

function formatLng(lng: number): string {
  const dir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lng).toFixed(3)}° ${dir}`;
}

function buildMarkdown(data: ISSData, units: "km" | "mi"): string {
  const km = (n: number) => (units === "mi" ? `${(n * 0.621371).toFixed(1)} mi` : `${n.toFixed(1)} km`);
  const kmh = (n: number) => (units === "mi" ? `${(n * 0.621371).toFixed(0)} mph` : `${n.toFixed(0)} km/h`);
  const mapsUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}&z=4`;
  const ts = new Date(data.timestamp * 1000).toUTCString();
  return [
    `### 🛰️ ISS — over **${formatLat(data.latitude)}, ${formatLng(data.longitude)}**`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Altitude | ${km(data.altitudeKm)} |`,
    `| Velocity | ${kmh(data.velocityKmh)} |`,
    `| Visibility | ${data.visibility} |`,
    `| Footprint | ${km(data.footprintKm)} radius |`,
    ``,
    `[Open in Google Maps](${mapsUrl})`,
    ``,
    `_Updated ${ts}_`,
  ].join("\n");
}

function ISS(props: Props) {
  const closeWidget = useCloseWidget();
  const units = props.units ?? "km";
  const [data, setData] = useState<ISSData | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(props.autoRefresh ?? false);
  const cancelledRef = useRef(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    cancelledRef.current = false;
    setStatus("loading");
    fetchISS()
      .then((d) => {
        if (cancelledRef.current) return;
        setData(d);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  function onRefresh() {
    setRefreshTick((t) => t + 1);
  }

  function onToggleAuto() {
    setAutoRefresh((a) => !a);
  }

  function onDone() {
    if (data) {
      closeWidget(
        `ISS at ${formatLat(data.latitude)}, ${formatLng(data.longitude)}, ` +
        `${data.altitudeKm.toFixed(1)} km altitude, ${data.velocityKmh.toFixed(0)} km/h, ${data.visibility}.`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Locating ISS…_ 🛰️"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : data
          ? buildMarkdown(data, units)
          : "";

  return (
    <Form
      header={<CardHeader title="ISS Location" iconBundleId="com.apple.weather" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={onRefresh} style="primary" />
          <Action
            title={autoRefresh ? "Stop auto-refresh" : "Auto-refresh"}
            onAction={onToggleAuto}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const ISSWidget = defineWidget({
  name: "get_iss_location",
  description:
    "Show the current location of the International Space Station — latitude, longitude, altitude, speed, and visibility — using the free Where The ISS At API. Optional auto-refresh every 5 seconds.",
  schema,
  component: ISS,
});

export default ISSWidget;
