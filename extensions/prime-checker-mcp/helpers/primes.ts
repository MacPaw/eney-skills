// Primality testing and factorization for non-negative integers up to ~2^53.
// For values that fit in Number (up to MAX_SAFE_INTEGER) we use a deterministic
// Miller-Rabin test with witnesses sufficient for all 64-bit-ish safe integers.

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n)) return false;
  if (n < 2) return false;
  if (n < 4) return true; // 2, 3
  if (n % 2 === 0) return false;
  if (n < 9) return true; // 5, 7
  if (n % 3 === 0) return false;
  // Trial divide small primes for tiny n; otherwise fall through to MR
  if (n < 1_000_000) {
    const sqrt = Math.floor(Math.sqrt(n));
    for (let i = 5; i <= sqrt; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }
  return millerRabin(BigInt(n));
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function millerRabin(n: bigint): boolean {
  if (n < 2n) return false;
  // Deterministic witnesses for all 64-bit integers per Sinclair (2011)
  const witnesses = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];
  let d = n - 1n;
  let r = 0n;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r++;
  }
  outer: for (const a of witnesses) {
    if (a >= n) continue;
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 0n; i < r - 1n; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}

export interface FactorEntry {
  prime: number;
  exponent: number;
}

export function factorize(n: number): FactorEntry[] {
  if (!Number.isInteger(n) || n < 2) return [];
  const result: FactorEntry[] = [];
  let x = n;
  // Trial divide by small primes
  for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31]) {
    if (x % p === 0) {
      let e = 0;
      while (x % p === 0) {
        x = x / p;
        e++;
      }
      result.push({ prime: p, exponent: e });
    }
  }
  // Wheel factorisation by 6k±1
  let i = 37;
  while (i * i <= x) {
    if (x % i === 0) {
      let e = 0;
      while (x % i === 0) {
        x = x / i;
        e++;
      }
      result.push({ prime: i, exponent: e });
    }
    i += i % 6 === 5 ? 2 : 4;
  }
  if (x > 1) {
    result.push({ prime: x, exponent: 1 });
  }
  return result;
}

export function nextPrime(n: number): number {
  let candidate = Math.max(2, Math.floor(n) + 1);
  if (candidate <= 2) return 2;
  if (candidate % 2 === 0) candidate++;
  while (!isPrime(candidate)) candidate += 2;
  return candidate;
}

export function previousPrime(n: number): number | null {
  let candidate = Math.floor(n) - 1;
  if (candidate < 2) return null;
  if (candidate === 2) return 2;
  if (candidate % 2 === 0) candidate--;
  while (candidate >= 2) {
    if (isPrime(candidate)) return candidate;
    candidate -= 2;
  }
  return null;
}

// Sieve of Eratosthenes for first N primes (used for "primes up to" listing)
export function primesUpTo(limit: number, max = 1000): number[] {
  if (limit < 2) return [];
  const safeLimit = Math.min(limit, 5_000_000);
  const sieve = new Uint8Array(safeLimit + 1);
  sieve[0] = 1;
  sieve[1] = 1;
  for (let i = 2; i * i <= safeLimit; i++) {
    if (!sieve[i]) {
      for (let j = i * i; j <= safeLimit; j += i) sieve[j] = 1;
    }
  }
  const primes: number[] = [];
  for (let i = 2; i <= safeLimit && primes.length < max; i++) {
    if (!sieve[i]) primes.push(i);
  }
  return primes;
}
