import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "path";

const DATA_PATH = path.join(process.env.HOME ?? "~", ".eney", "net-worth.json");

export type AssetType = "crypto" | "stock" | "cash";

export interface Position {
  id: string;
  type: AssetType;
  symbol: string;
  account: string;
  amount: number;
  buyPrice: number;
  currency: string;
  addedAt: string;
}

export interface Portfolio {
  positions: Position[];
}

export async function loadPortfolio(): Promise<Portfolio> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { positions: [] };
  }
}

export async function savePortfolio(portfolio: Portfolio): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(portfolio, null, 2), "utf8");
}

export async function addPosition(pos: Omit<Position, "id" | "addedAt">): Promise<Position> {
  const portfolio = await loadPortfolio();
  const position: Position = { ...pos, id: randomUUID(), addedAt: new Date().toISOString() };
  portfolio.positions.push(position);
  await savePortfolio(portfolio);
  return position;
}

export async function removePosition(id: string): Promise<void> {
  const portfolio = await loadPortfolio();
  portfolio.positions = portfolio.positions.filter((p) => p.id !== id);
  await savePortfolio(portfolio);
}
