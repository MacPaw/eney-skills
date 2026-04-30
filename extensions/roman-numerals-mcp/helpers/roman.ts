const SYMBOLS: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

const VALUES: Record<string, number> = {
  M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1,
};

export const MIN_INT = 1;
export const MAX_INT = 3999;

export function intToRoman(n: number): string {
  if (!Number.isInteger(n) || n < MIN_INT || n > MAX_INT) {
    throw new Error(`Roman numerals are defined for integers ${MIN_INT}-${MAX_INT}.`);
  }
  let remaining = n;
  let out = "";
  for (const [value, symbol] of SYMBOLS) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}

export function romanToInt(input: string): number {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) throw new Error("Empty input.");
  if (!/^[IVXLCDM]+$/.test(trimmed)) throw new Error("Roman numerals use only I, V, X, L, C, D, M.");
  let total = 0;
  let i = 0;
  for (const [value, symbol] of SYMBOLS) {
    while (trimmed.startsWith(symbol, i)) {
      total += value;
      i += symbol.length;
    }
  }
  if (i !== trimmed.length) throw new Error("Not a canonical Roman numeral.");
  if (intToRoman(total) !== trimmed) throw new Error("Not a canonical Roman numeral.");
  if (total < MIN_INT || total > MAX_INT) throw new Error(`Out of range (${MIN_INT}-${MAX_INT}).`);
  void VALUES;
  return total;
}
