type Options = {
  length?: number;
  symbols: boolean;
  numbers: boolean;
};

// Minimal interface to avoid depending on DOM lib types
interface WebCryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

// Prefer the Web Crypto API on globalThis (Node 18+ and modern browsers)
const cryptoApi = (globalThis as any).crypto as WebCryptoLike;

function randomInt(max: number) {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  let random: number;
  do {
    cryptoApi.getRandomValues(buffer);
    random = buffer[0];
  } while (random >= limit);
  return random % max;
}

function pick(str: string) {
  return str[randomInt(str.length)];
}

export function generatePassword(options: Options) {
  const minSize = 6;
  const length = options.length ? Math.max(options.length, minSize) : 20;
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*?_~";
  const pool =
    letters +
    (options.numbers ? numbers : "") +
    (options.symbols ? symbols : "");

  const result = [];

  // ensure required classes appear at least once
  result.push(pick(letters));
  if (options.numbers) result.push(pick(numbers));
  if (options.symbols) result.push(pick(symbols));

  while (result.length < length) result.push(pick(pool));

  // shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}
