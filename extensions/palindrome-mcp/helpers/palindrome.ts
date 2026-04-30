// Palindrome and anagram helpers. All operations are pure / synchronous.

export interface NormalizeOptions {
  ignoreCase?: boolean;
  ignorePunctuation?: boolean;
}

export function normalize(text: string, opts: NormalizeOptions): string {
  let s = text;
  if (opts.ignoreCase) s = s.toLowerCase();
  if (opts.ignorePunctuation) {
    // Strip everything that isn't a letter or digit (Unicode-aware).
    s = s.replace(/[^\p{L}\p{N}]/gu, "");
  }
  return s;
}

export function reverse(text: string): string {
  // Use Array.from to preserve multi-codepoint graphemes (surrogate pairs).
  return Array.from(text).reverse().join("");
}

export function isPalindrome(text: string, opts: NormalizeOptions): boolean {
  const normalized = normalize(text, opts);
  if (normalized.length === 0) return false;
  return normalized === reverse(normalized);
}

export function isAnagram(a: string, b: string, opts: NormalizeOptions): boolean {
  const na = normalize(a, opts);
  const nb = normalize(b, opts);
  if (na.length === 0 || na.length !== nb.length) return false;
  return Array.from(na).sort().join("") === Array.from(nb).sort().join("");
}

// Find all palindromic substrings of at least minLength characters,
// after normalisation. Capped at maxResults; deduplicated by value.
export function findPalindromes(
  text: string,
  opts: NormalizeOptions & { minLength?: number; maxResults?: number } = {},
): string[] {
  const minLength = opts.minLength ?? 3;
  const maxResults = opts.maxResults ?? 50;
  const normalized = normalize(text, opts);
  const arr = Array.from(normalized);
  const found = new Set<string>();
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + minLength; j <= arr.length; j++) {
      const sub = arr.slice(i, j).join("");
      if (sub === reverse(sub)) {
        found.add(sub);
        if (found.size >= maxResults) break;
      }
    }
    if (found.size >= maxResults) break;
  }
  return Array.from(found);
}
