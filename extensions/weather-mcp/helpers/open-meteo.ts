export interface GeocodedLocation {
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface CurrentWeather {
  location: GeocodedLocation;
  temperatureC: number;
  apparentTemperatureC: number;
  humidity: number;
  windKph: number;
  weatherCode: number;
  isDay: boolean;
  observedAt: string;
}

interface GeocodeResponse {
  results?: Array<{
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
}

interface ForecastResponse {
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
}

export async function geocode(query: string): Promise<GeocodedLocation | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding API returned ${res.status}`);
  const json = (await res.json()) as GeocodeResponse;
  const first = json.results?.[0];
  if (!first) return null;
  return {
    name: first.name,
    country: first.country ?? "",
    admin1: first.admin1 ?? "",
    latitude: first.latitude,
    longitude: first.longitude,
    timezone: first.timezone ?? "auto",
  };
}

export async function fetchCurrentWeather(location: GeocodedLocation): Promise<CurrentWeather | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
  );
  url.searchParams.set("timezone", location.timezone || "auto");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
  const json = (await res.json()) as ForecastResponse;
  if (!json.current) return null;
  return {
    location,
    temperatureC: json.current.temperature_2m,
    apparentTemperatureC: json.current.apparent_temperature,
    humidity: json.current.relative_humidity_2m,
    windKph: json.current.wind_speed_10m,
    weatherCode: json.current.weather_code,
    isDay: json.current.is_day === 1,
    observedAt: json.current.time,
  };
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with light hail",
  99: "Thunderstorm with heavy hail",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] ?? `Code ${code}`;
}
