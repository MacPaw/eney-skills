import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  CurrentWeather,
  GeocodedLocation,
  describeWeatherCode,
  fetchCurrentWeather,
  geocode,
} from "../helpers/open-meteo.js";

const schema = z.object({
  location: z.string().optional().describe("The city, town, or place name to look up."),
  unit: z.enum(["c", "f"]).optional().describe("Temperature unit: 'c' (Celsius, default) or 'f' (Fahrenheit)."),
});

type Props = z.infer<typeof schema>;

type Unit = "c" | "f";

function formatTemp(c: number, unit: Unit): string {
  if (unit === "f") return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${Math.round(c)}°C`;
}

function formatLocation(loc: GeocodedLocation): string {
  return [loc.name, loc.admin1, loc.country].filter(Boolean).join(", ");
}

function CurrentWeatherWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [location, setLocation] = useState(props.location ?? "");
  const [unit, setUnit] = useState<Unit>(props.unit ?? "c");
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    const trimmed = location.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError("");
    try {
      const geo = await geocode(trimmed);
      if (!geo) {
        setError(`No location found for "${trimmed}".`);
        setWeather(null);
        return;
      }
      const result = await fetchCurrentWeather(geo);
      if (!result) {
        setError("Weather data unavailable.");
        setWeather(null);
        return;
      }
      setWeather(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onDone() {
    if (!weather) {
      closeWidget("Weather lookup cancelled.");
      return;
    }
    const desc = describeWeatherCode(weather.weatherCode);
    closeWidget(`${formatLocation(weather.location)}: ${formatTemp(weather.temperatureC, unit)}, ${desc}.`);
  }

  const header = <CardHeader title="Current Weather" iconBundleId="com.apple.weather" />;

  if (weather) {
    const description = describeWeatherCode(weather.weatherCode);
    const lines: string[] = [];
    lines.push(`### ${formatLocation(weather.location)}`);
    lines.push("");
    lines.push(`**${formatTemp(weather.temperatureC, unit)}** — ${description}${weather.isDay ? "" : " (night)"}`);
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| Feels like | ${formatTemp(weather.apparentTemperatureC, unit)} |`);
    lines.push(`| Humidity | ${weather.humidity}% |`);
    lines.push(`| Wind | ${Math.round(weather.windKph)} km/h |`);
    lines.push(`| Observed | ${weather.observedAt} |`);

    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="New Lookup" onSubmit={() => setWeather(null)} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={lines.join("\n")} />
        <Form.TextField name="location" label="Location" value={location} onChange={setLocation} isCopyable />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Looking up..." : "Get Weather"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!location.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="location" label="Location" value={location} onChange={setLocation} />
      <Form.Dropdown name="unit" label="Unit" value={unit} onChange={(v) => setUnit(v as Unit)}>
        <Form.Dropdown.Item title="Celsius" value="c" />
        <Form.Dropdown.Item title="Fahrenheit" value="f" />
      </Form.Dropdown>
    </Form>
  );
}

const CurrentWeatherWidgetExport = defineWidget({
  name: "current-weather",
  description: "Show the current weather for a city or location using the Open-Meteo API.",
  schema,
  component: CurrentWeatherWidget,
});

export default CurrentWeatherWidgetExport;
