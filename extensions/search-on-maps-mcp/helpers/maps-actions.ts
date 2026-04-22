import { runScript } from "@eney/api";

export function openMapsSearch(query: string): Promise<string> {
  const encoded = encodeURIComponent(query);
  return runScript(`open location "maps://?q=${encoded}"`);
}

export function openMapsSearchNear(query: string, lat: number, lng: number): Promise<string> {
  const encoded = encodeURIComponent(query);
  return runScript(`open location "maps://?q=${encoded}&near=${lat},${lng}"`);
}

