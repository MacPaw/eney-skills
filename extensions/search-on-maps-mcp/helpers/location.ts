export interface UserLocation {
  lat: number;
  lng: number;
  city?: string;
  precise: boolean; // true = GPS, false = IP-based
}

// WebKit IP-based fallback positions typically report accuracy > 5000m.
// CoreLocation WiFi positioning on a Mac is typically 30–300m.
const IP_ACCURACY_THRESHOLD_M = 5000;

async function tryGeolocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (pos.coords.accuracy > IP_ACCURACY_THRESHOLD_M) {
          reject(new Error("Location accuracy too low — WebKit returned IP-based position"));
          return;
        }
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precise: true });
      },
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

async function tryIpGeolocation(): Promise<UserLocation> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        return { lat: data.latitude, lng: data.longitude, city: data.city, precise: false };
      }
    }
  } catch {}

  const res = await fetch("https://ipinfo.io/json");
  if (!res.ok) throw new Error("IP geolocation failed");
  const data = await res.json();
  if (!data.loc) throw new Error("IP geolocation returned no location");
  const [lat, lng] = data.loc.split(",").map(Number);
  return { lat, lng, city: data.city, precise: false };
}

export async function requestGPSLocation(): Promise<UserLocation> {
  return tryGeolocation();
}

export async function requestIPLocation(): Promise<UserLocation> {
  return tryIpGeolocation();
}

export async function geocodeCity(near: string): Promise<UserLocation> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(near)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": "Eney-SearchOnMaps/1.0" } });
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: ${near}`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), city: near, precise: false };
}
