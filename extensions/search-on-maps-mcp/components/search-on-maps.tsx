import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import { requestGPSLocation, requestIPLocation, geocodeCity, UserLocation } from "../helpers/location.js";
import { searchNearby, Place } from "../helpers/overpass.js";
import { openMapsSearch, openMapsSearchNear } from "../helpers/maps-actions.js";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("What to search for nearby (e.g., 'coffee', 'restaurants', 'pharmacy')."),
  near: z
    .string()
    .optional()
    .describe(
      "Location if the user mentioned it explicitly (e.g., 'Kyiv', 'Paris'). Leave empty to auto-detect from the user's device.",
    ),
  radiusMeters: z
    .number()
    .optional()
    .describe("Search radius in meters. Default is 1000."),
});

type Props = z.infer<typeof schema>;
type Status = "permission" | "locating" | "fetching" | "done" | "error";

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function placesMarkdown(places: Place[]): string {
  return places
    .map((p, i) => {
      const mapsUrl = `maps://?ll=${p.lat},${p.lng}&q=${encodeURIComponent(p.name)}`;
      const dist = p.distanceM != null ? ` · ${formatDistance(p.distanceM)}` : "";
      const addr = p.address ? `\n📍 ${p.address}` : "";
      const hours = p.openingHours ? `\n⏰ ${p.openingHours}` : "";
      return `**${i + 1}. [${p.name}](${mapsUrl})**${dist}${addr}${hours}`;
    })
    .join("\n\n");
}

function SearchOnMaps(props: Props) {
  const closeWidget = useCloseWidget();
  const [status, setStatus] = useState<Status>(props.near ? "locating" : "permission");
  const [error, setError] = useState("");
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [locationInput, setLocationInput] = useState(props.near ?? "");

  useEffect(() => {
    if (props.near) run();
  }, []);

  async function fetchPlaces(loc: UserLocation) {
    setLocation(loc);
    if (!locationInput) setLocationInput(loc.city ?? "");
    setStatus("fetching");
    const results = await searchNearby(
      loc.lat,
      loc.lng,
      props.query ?? "cafe",
      props.radiusMeters ?? 1000,
    );
    setPlaces(results);
    setStatus("done");
  }

  async function run(overrideLocation?: string) {
    try {
      setStatus("locating");
      const loc = overrideLocation
        ? await geocodeCity(overrideLocation)
        : await geocodeCity(props.near!);
      await fetchPlaces(loc);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function onUseGPS() {
    setStatus("locating");
    try {
      const loc = await requestGPSLocation();
      await fetchPlaces(loc);
    } catch {
      // Permission denied or unavailable — fall back to IP silently
      await onUseIP();
    }
  }

  async function onUseIP() {
    setStatus("locating");
    try {
      const loc = await requestIPLocation();
      await fetchPlaces(loc);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function onRetryWithLocation() {
    if (!locationInput.trim()) return;
    try {
      setStatus("locating");
      const loc = await geocodeCity(locationInput);
      await fetchPlaces(loc);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function onShowAll() {
    const q = props.query ?? "places";
    if (location) {
      await openMapsSearchNear(q, location.lat, location.lng);
    } else {
      await openMapsSearch(q);
    }
  }

  const title = props.query
    ? `${props.query.charAt(0).toUpperCase()}${props.query.slice(1)} Nearby`
    : "Search on Maps";

  const header = <CardHeader title={title} iconBundleId="com.apple.Maps" />;

  if (status === "permission") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Use My Location" onAction={onUseGPS} style="primary" />
            <Action title="Use Approximate" onAction={onUseIP} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper markdown="Allow access to your precise location for better results, or use an approximate location based on your IP address." />
      </Form>
    );
  }

  if (status === "locating" || status === "fetching") {
    const msg = status === "locating" ? "_Detecting your location…_" : "_Finding nearby places…_";
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Cancel" onAction={() => closeWidget("Cancelled")} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper markdown={msg} />
      </Form>
    );
  }

  if (status === "error") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Retry" onAction={() => setStatus("permission")} style="primary" />
            <Action title="Cancel" onAction={() => closeWidget("Cancelled")} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`**Error:** ${error}`} />
      </Form>
    );
  }

  if (places.length === 0) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="Search Here"
              onSubmit={onRetryWithLocation}
              style="primary"
              isDisabled={!locationInput.trim()}
            />
            <Action title="Cancel" onAction={() => closeWidget("Cancelled")} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper
          markdown={`No **${props.query ?? "places"}** found in this area. Try a different city, district, or street:`}
        />
        <Form.TextField
          name="location"
          label="Area"
          value={locationInput}
          onChange={setLocationInput}
        />
      </Form>
    );
  }

  const locationNote =
    location && !location.precise
      ? `\n\n_📡 Location based on IP${location.city ? ` (${location.city})` : ""} — results may not reflect your exact position._`
      : "";

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action title="Show All in Maps" onAction={onShowAll} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={placesMarkdown(places) + locationNote} />
    </Form>
  );
}

const SearchOnMapsWidget = defineWidget({
  name: "search-on-maps",
  description: "Find nearby places using OpenStreetMap and open them in Apple Maps",
  schema,
  component: SearchOnMaps,
});

export default SearchOnMapsWidget;
