// Fibonacci helpers using BigInt to avoid 53-bit precision loss for large n.
// Iterative computation; F(0) = 0, F(1) = 1.

export function fib(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("n must be a non-negative integer.");
  }
  if (n > 20000) {
    throw new Error("n must be ≤ 20,000 for performance reasons.");
  }
  if (n === 0) return 0n;
  if (n === 1) return 1n;
  let a = 0n;
  let b = 1n;
  for (let i = 2; i <= n; i++) {
    const next = a + b;
    a = b;
    b = next;
  }
  return b;
}

export function fibSequence(limit: number): bigint[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("limit must be a non-negative integer.");
  }
  if (limit > 200) {
    throw new Error("limit must be ≤ 200 for the sequence view.");
  }
  const out: bigint[] = [];
  let a = 0n;
  let b = 1n;
  for (let i = 0; i <= limit; i++) {
    out.push(a);
    const next = a + b;
    a = b;
    b = next;
  }
  return out;
}

// Find the index of the smallest Fibonacci number >= target.
export function fibIndexOfAtLeast(target: bigint): number {
  if (target < 0n) throw new Error("target must be non-negative.");
  if (target === 0n) return 0;
  if (target === 1n) return 1;
  let a = 0n;
  let b = 1n;
  let i = 1;
  while (b < target) {
    const next = a + b;
    a = b;
    b = next;
    i++;
    if (i > 20000) throw new Error("target too large.");
  }
  return i;
}
