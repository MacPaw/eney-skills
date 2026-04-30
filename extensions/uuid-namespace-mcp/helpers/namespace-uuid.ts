// RFC 4122 §4.3 namespace UUID generation (v3 = MD5, v5 = SHA-1).
// Standard predefined namespaces from §Appendix C.

import { createHash } from "node:crypto";

export const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
export const NAMESPACE_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
export const NAMESPACE_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";
export const NAMESPACE_X500 = "6ba7b814-9dad-11d1-80b4-00c04fd430c8";

const PREDEFINED: Record<string, string> = {
  dns: NAMESPACE_DNS,
  url: NAMESPACE_URL,
  oid: NAMESPACE_OID,
  x500: NAMESPACE_X500,
};

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function resolveNamespace(input: string): string {
  const lower = input.trim().toLowerCase();
  if (PREDEFINED[lower]) return PREDEFINED[lower];
  if (UUID_RE.test(input.trim())) return input.trim().toLowerCase();
  throw new Error(`Namespace must be 'dns'/'url'/'oid'/'x500' or a UUID, got: ${input}`);
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function generate(version: 3 | 5, namespace: string, name: string): string {
  const ns = resolveNamespace(namespace);
  const algo = version === 3 ? "md5" : "sha1";
  const hash = createHash(algo);
  hash.update(uuidToBytes(ns));
  hash.update(name, "utf8");
  const bytes = hash.digest().subarray(0, 16);
  // Set version (bits 4-7 of byte 6) and variant (bits 6-7 of byte 8)
  bytes[6] = (bytes[6] & 0x0f) | (version === 3 ? 0x30 : 0x50);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}
