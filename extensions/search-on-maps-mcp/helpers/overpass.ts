import { runScript } from "@eney/api";

export interface Place {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  openingHours?: string;
  distanceM?: number;
}

const TAG_MAP: [string, Array<[string, string]>][] = [
  // Food & drink
  ["coffee", [["amenity", "cafe"]]],
  ["cafe", [["amenity", "cafe"]]],
  ["bakery", [["shop", "bakery"]]],
  ["restaurant", [["amenity", "restaurant"]]],
  ["fast food", [["amenity", "fast_food"]]],
  ["food", [["amenity", "restaurant"], ["amenity", "fast_food"], ["amenity", "cafe"]]],
  ["bar", [["amenity", "bar"], ["amenity", "pub"]]],
  ["pub", [["amenity", "pub"], ["amenity", "bar"]]],
  // Health
  ["pharmacy", [["amenity", "pharmacy"]]],
  ["hospital", [["amenity", "hospital"]]],
  ["clinic", [["amenity", "clinic"]]],
  ["doctor", [["amenity", "doctors"], ["amenity", "clinic"]]],
  ["dentist", [["amenity", "dentist"]]],
  ["vet", [["amenity", "veterinary"]]],
  ["veterinary", [["amenity", "veterinary"]]],
  // Shops
  ["pet store", [["shop", "pet"]]],
  ["pet shop", [["shop", "pet"]]],
  ["petstore", [["shop", "pet"]]],
  ["pet", [["shop", "pet"], ["amenity", "veterinary"]]],
  ["supermarket", [["shop", "supermarket"]]],
  ["grocery", [["shop", "supermarket"], ["shop", "convenience"]]],
  ["convenience", [["shop", "convenience"]]],
  ["electronics", [["shop", "electronics"]]],
  ["clothes", [["shop", "clothes"]]],
  ["clothing", [["shop", "clothes"]]],
  ["bookstore", [["shop", "books"]]],
  ["books", [["shop", "books"]]],
  ["hardware", [["shop", "hardware"]]],
  ["florist", [["shop", "florist"]]],
  ["jewelry", [["shop", "jewelry"]]],
  ["sport", [["shop", "sports"]]],
  ["sports", [["shop", "sports"]]],
  ["laundry", [["shop", "laundry"]]],
  // Beauty & care
  ["salon", [["shop", "hairdresser"], ["shop", "beauty"]]],
  ["hairdresser", [["shop", "hairdresser"]]],
  ["barber", [["shop", "hairdresser"]]],
  ["beauty", [["shop", "beauty"], ["shop", "hairdresser"]]],
  // Transport
  ["gas", [["amenity", "fuel"]]],
  ["fuel", [["amenity", "fuel"]]],
  ["parking", [["amenity", "parking"]]],
  // Finance
  ["atm", [["amenity", "atm"]]],
  ["bank", [["amenity", "bank"]]],
  // Accommodation
  ["hotel", [["tourism", "hotel"]]],
  ["hostel", [["tourism", "hostel"]]],
  // Culture & leisure
  ["museum", [["tourism", "museum"]]],
  ["park", [["leisure", "park"]]],
  ["gym", [["leisure", "fitness_centre"]]],
  ["fitness", [["leisure", "fitness_centre"]]],
  ["cinema", [["amenity", "cinema"]]],
  ["theatre", [["amenity", "theatre"]]],
  ["theater", [["amenity", "theatre"]]],
  ["nightclub", [["amenity", "nightclub"]]],
  // Services
  ["post", [["amenity", "post_office"]]],
  ["library", [["amenity", "library"]]],
  ["school", [["amenity", "school"]]],
];

function tagsForQuery(query: string): Array<[string, string]> {
  const lower = query.toLowerCase();
  for (const [keyword, tags] of TAG_MAP) {
    if (lower.includes(keyword)) return tags;
  }
  // Fallback: try both shop and amenity with the normalised query term
  const term = lower.replace(/\s+/g, "_");
  return [["shop", term], ["amenity", term]];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractAddress(tags: Record<string, string>): string | undefined {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  const city = tags["addr:city"];
  const parts = [street && number ? `${street} ${number}` : street, city].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

export async function searchNearby(
  lat: number,
  lng: number,
  query: string,
  radiusMeters = 1000,
  limit = 10,
): Promise<Place[]> {
  const tags = tagsForQuery(query);
  const filters = tags
    .map(
      ([k, v]) => `
  node["${k}"="${v}"](around:${radiusMeters},${lat},${lng});
  way["${k}"="${v}"](around:${radiusMeters},${lat},${lng});`,
    )
    .join("");
  const overpassQuery = `[out:json][timeout:15];\n(\n${filters}\n);\nout body center ${limit * 3};`;

  // Use curl via runScript to avoid CORS restrictions in the webview
  const script = `set q to ${JSON.stringify(overpassQuery)}
do shell script "printf '%s' " & quoted form of q & " | curl -sf --max-time 20 -X POST https://overpass-api.de/api/interpreter --data @-"`;
  const jsonText = await runScript(script);
  const data = JSON.parse(jsonText);

  return (
    data.elements
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((el: any) => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        return el.tags?.name && lat != null && lng != null;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((el: any) => {
        const pLat: number = el.lat ?? el.center?.lat;
        const pLng: number = el.lon ?? el.center?.lon;
        return {
          id: el.id,
          name: el.tags.name,
          lat: pLat,
          lng: pLng,
          address: extractAddress(el.tags),
          openingHours: el.tags.opening_hours,
          distanceM: haversine(lat, lng, pLat, pLng),
        } as Place;
      })
      .sort((a: Place, b: Place) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
      .slice(0, limit)
  );
}
