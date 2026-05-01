// Leet-speak (1337) translation tables for three intensity levels.

export type Level = "basic" | "intermediate" | "advanced";

const BASIC: Record<string, string> = {
  a: "4",
  e: "3",
  i: "1",
  o: "0",
  s: "5",
  t: "7",
};

const INTERMEDIATE: Record<string, string> = {
  ...BASIC,
  b: "8",
  g: "9",
  l: "1",
  z: "2",
};

const ADVANCED: Record<string, string> = {
  a: "4",
  b: "|3",
  c: "(",
  d: "|)",
  e: "3",
  f: "|=",
  g: "9",
  h: "|-|",
  i: "1",
  j: "_|",
  k: "|<",
  l: "|_",
  m: "/\\/\\",
  n: "|\\|",
  o: "0",
  p: "|D",
  q: "0_",
  r: "|2",
  s: "5",
  t: "7",
  u: "|_|",
  v: "\\/",
  w: "\\/\\/",
  x: "><",
  y: "`/",
  z: "2",
};

function tableFor(level: Level): Record<string, string> {
  if (level === "basic") return BASIC;
  if (level === "intermediate") return INTERMEDIATE;
  return ADVANCED;
}

export function toLeet(text: string, level: Level): string {
  const table = tableFor(level);
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    out += table[lower] ?? ch;
  }
  return out;
}

// Best-effort decode: reverse the basic table. Advanced glyphs are
// ambiguous (e.g. "|" appears in many letters) so we only reverse the
// numeric substitutions in 'basic'/'intermediate'.
const REVERSE_BASIC: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(BASIC)) out[v] = k;
  return out;
})();

export function fromLeet(text: string): string {
  let out = "";
  for (const ch of text) {
    out += REVERSE_BASIC[ch] ?? ch;
  }
  return out;
}
