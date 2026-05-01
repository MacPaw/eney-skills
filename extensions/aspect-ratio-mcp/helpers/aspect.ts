// Aspect ratio helpers.
// Reduce W:H by dividing by GCD; also recognises a few common named ratios.

export interface Reduced {
  num: number;
  den: number;
  decimal: number;
  named: string | null;
}

const NAMED: { name: string; ratio: number; w: number; h: number }[] = [
  { name: "1:1 (square)", ratio: 1, w: 1, h: 1 },
  { name: "5:4", ratio: 5 / 4, w: 5, h: 4 },
  { name: "4:3 (Standard / iPad)", ratio: 4 / 3, w: 4, h: 3 },
  { name: "3:2 (35mm / DSLR)", ratio: 3 / 2, w: 3, h: 2 },
  { name: "16:10 (WUXGA)", ratio: 16 / 10, w: 16, h: 10 },
  { name: "16:9 (HD / 4K)", ratio: 16 / 9, w: 16, h: 9 },
  { name: "1.85:1 (Widescreen film)", ratio: 1.85, w: 0, h: 0 },
  { name: "21:9 (Ultrawide)", ratio: 21 / 9, w: 21, h: 9 },
  { name: "2.39:1 (Anamorphic / CinemaScope)", ratio: 2.39, w: 0, h: 0 },
  { name: "9:16 (Portrait HD / mobile)", ratio: 9 / 16, w: 9, h: 16 },
  { name: "2:3 (Portrait DSLR)", ratio: 2 / 3, w: 2, h: 3 },
  { name: "3:4 (Portrait Standard)", ratio: 3 / 4, w: 3, h: 4 },
];

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

function nearestNamed(ratio: number, tolerance = 0.005): string | null {
  let best: { name: string; diff: number } | null = null;
  for (const n of NAMED) {
    const diff = Math.abs(n.ratio - ratio);
    if (diff <= tolerance && (!best || diff < best.diff)) {
      best = { name: n.name, diff };
    }
  }
  return best ? best.name : null;
}

export function reduce(width: number, height: number): Reduced {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Width and height must be positive numbers.");
  }
  // For non-integer inputs, scale to integers first
  let w = width;
  let h = height;
  const scale = (() => {
    const wDecimals = (String(w).split(".")[1] ?? "").length;
    const hDecimals = (String(h).split(".")[1] ?? "").length;
    return Math.pow(10, Math.max(wDecimals, hDecimals));
  })();
  const wi = Math.round(w * scale);
  const hi = Math.round(h * scale);
  const g = gcd(wi, hi);
  return {
    num: wi / g,
    den: hi / g,
    decimal: w / h,
    named: nearestNamed(w / h),
  };
}

export interface DimensionsForRatio {
  width: number;
  height: number;
}

// Given a ratio "num:den" and one dimension, compute the other.
export function fromOneDimension(num: number, den: number, knownWidth?: number, knownHeight?: number): DimensionsForRatio {
  if (num <= 0 || den <= 0) throw new Error("Ratio numerator and denominator must be positive.");
  if (knownWidth !== undefined && knownWidth > 0) {
    return { width: knownWidth, height: (knownWidth * den) / num };
  }
  if (knownHeight !== undefined && knownHeight > 0) {
    return { width: (knownHeight * num) / den, height: knownHeight };
  }
  throw new Error("Provide either knownWidth or knownHeight.");
}
