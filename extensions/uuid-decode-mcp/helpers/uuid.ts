const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const GREGORIAN_OFFSET_MS = 12_219_292_800_000;

export interface DecodedUuid {
  canonical: string;
  hex: string;
  version: number;
  versionLabel: string;
  variant: string;
  timestamp: Date | null;
  timestampNote: string;
  bytes: number[];
}

const VERSION_LABELS: Record<number, string> = {
  1: "v1 (time-based, MAC address)",
  2: "v2 (DCE Security)",
  3: "v3 (name-based, MD5)",
  4: "v4 (random)",
  5: "v5 (name-based, SHA-1)",
  6: "v6 (time-based, reordered)",
  7: "v7 (time-based, Unix epoch ms)",
  8: "v8 (custom / vendor-defined)",
};

function variantLabel(byte8: number): string {
  if ((byte8 & 0x80) === 0) return "Reserved (NCS, pre-RFC 4122)";
  if ((byte8 & 0xc0) === 0x80) return "RFC 4122 / RFC 9562";
  if ((byte8 & 0xe0) === 0xc0) return "Reserved (Microsoft GUID)";
  return "Reserved (future)";
}

function timestampForV1(bytes: number[]): Date {
  const high = bytes[6] & 0x0f;
  const lowMid =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const mid = (bytes[4] << 8) | bytes[5];
  const lowMidUnsigned = lowMid >>> 0;
  const ticks = BigInt(high) << 48n;
  const tickMid = BigInt(mid) << 32n;
  const tickLow = BigInt(lowMidUnsigned);
  const total = ticks | tickMid | tickLow;
  const ms = Number(total / 10000n) - GREGORIAN_OFFSET_MS;
  return new Date(ms);
}

function timestampForV6(bytes: number[]): Date {
  const high = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const mid = (bytes[4] << 8) | bytes[5];
  const lowNibble = bytes[6] & 0x0f;
  const trailing = bytes[7];
  const ticks =
    (BigInt(high >>> 0) << 28n) |
    (BigInt(mid) << 12n) |
    (BigInt(lowNibble) << 8n) |
    BigInt(trailing);
  const ms = Number(ticks / 10000n) - GREGORIAN_OFFSET_MS;
  return new Date(ms);
}

function timestampForV7(bytes: number[]): Date {
  const ms =
    bytes[0] * 2 ** 40 +
    bytes[1] * 2 ** 32 +
    bytes[2] * 2 ** 24 +
    bytes[3] * 2 ** 16 +
    bytes[4] * 2 ** 8 +
    bytes[5];
  return new Date(ms);
}

export function decodeUuid(input: string): DecodedUuid | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Enter a UUID." };
  const stripped = trimmed
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .replace(/^urn:uuid:/i, "");
  if (!UUID_RE.test(stripped)) return { error: "Not a canonical UUID (expected 8-4-4-4-12 hex)." };
  const hex = stripped.replace(/-/g, "").toLowerCase();
  const bytes: number[] = [];
  for (let i = 0; i < 16; i += 1) bytes.push(Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));

  const version = (bytes[6] >> 4) & 0x0f;
  const versionLabel = VERSION_LABELS[version] ?? `v${version} (unknown)`;
  const variant = variantLabel(bytes[8]);

  let timestamp: Date | null = null;
  let timestampNote = "_(not time-based)_";
  if (version === 1) {
    timestamp = timestampForV1(bytes);
    timestampNote = "100ns ticks since 1582-10-15";
  } else if (version === 6) {
    timestamp = timestampForV6(bytes);
    timestampNote = "100ns ticks since 1582-10-15 (reordered)";
  } else if (version === 7) {
    timestamp = timestampForV7(bytes);
    timestampNote = "milliseconds since 1970-01-01";
  }
  if (timestamp && Number.isNaN(timestamp.getTime())) {
    timestamp = null;
    timestampNote = "_(timestamp out of range)_";
  }

  return {
    canonical: stripped.toLowerCase(),
    hex,
    version,
    versionLabel,
    variant,
    timestamp,
    timestampNote,
    bytes,
  };
}
