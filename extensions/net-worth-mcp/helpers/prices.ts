import { AssetType } from "./storage.js";

export interface PriceResult {
  currentPrice: number;
  currency: string;
}

// Crypto: resolve ticker → CoinGecko ID, then fetch price
async function fetchCryptoPrice(symbol: string): Promise<number> {
  const searchRes = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`
  );
  const searchData = await searchRes.json() as { coins: { id: string; symbol: string }[] };
  const match = searchData.coins.find(
    (c) => c.symbol.toLowerCase() === symbol.toLowerCase()
  );
  if (!match) throw new Error(`Crypto not found: ${symbol}`);

  const priceRes = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${match.id}&vs_currencies=usd`
  );
  const priceData = await priceRes.json() as Record<string, { usd: number }>;
  return priceData[match.id].usd;
}

// Stock: Yahoo Finance unofficial
async function fetchStockPrice(symbol: string): Promise<number> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  );
  const data = await res.json() as {
    chart: { result: { meta: { regularMarketPrice: number } }[] };
  };
  const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!price) throw new Error(`Stock not found: ${symbol}`);
  return price;
}

// Cash: returns 1 (nominal value unchanged), caller handles inflation separately
async function fetchCashPrice(): Promise<number> {
  return 1;
}

export async function fetchCurrentPrice(type: AssetType, symbol: string): Promise<number> {
  switch (type) {
    case "crypto": return fetchCryptoPrice(symbol);
    case "stock": return fetchStockPrice(symbol);
    case "cash": return fetchCashPrice();
  }
}

// World Bank CPI: returns cumulative inflation multiplier since a given date
// e.g. 0.13 means 13% purchasing power loss
const WORLD_BANK_COUNTRY: Record<string, string> = {
  USD: "US", EUR: "DE", GBP: "GB", UAH: "UA",
  CAD: "CA", AUD: "AU", CHF: "CH", JPY: "JP",
};

export async function getInflationLoss(currency: string, sinceDate: string): Promise<number> {
  const countryCode = WORLD_BANK_COUNTRY[currency.toUpperCase()] ?? "US";
  const sinceYear = new Date(sinceDate).getFullYear();
  const currentYear = new Date().getFullYear();

  const res = await fetch(
    `https://api.worldbank.org/v2/country/${countryCode}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=20&mrv=${currentYear - sinceYear + 2}`
  );
  const data = await res.json() as [unknown, { date: string; value: number | null }[]];
  const rates = data[1] ?? [];

  let multiplier = 1;
  for (let year = sinceYear; year < currentYear; year++) {
    const entry = rates.find((r) => r.date === String(year));
    const rate = entry?.value ?? 3; // fallback to 3% if data missing
    multiplier *= 1 + rate / 100;
  }

  return multiplier; // e.g. 1.13 means prices are 13% higher → real value = amount / 1.13
}
