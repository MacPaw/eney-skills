import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import PrimeCheckerWidget from "../components/check_prime.js";
import { isPrime, factorize, nextPrime, previousPrime, primesUpTo } from "../helpers/primes.js";

describe("Prime checker widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(PrimeCheckerWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Check, Next prime, List primes, and Done actions", async () => {
    const session = await createUIXTestSession(PrimeCheckerWidget);

    assert.ok(session.findWidget({ title: "Check" }), "should have Check button");
    assert.ok(session.findWidget({ title: "Next prime" }), "should have Next prime button");
    assert.ok(session.findWidget({ title: "List primes ≤ N" }), "should have List primes button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});

describe("primes helpers", () => {
  it("isPrime returns false for n < 2", () => {
    assert.equal(isPrime(0), false);
    assert.equal(isPrime(1), false);
    assert.equal(isPrime(-7), false);
  });

  it("isPrime is correct for small values", () => {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 97, 101];
    for (const p of primes) assert.equal(isPrime(p), true, `${p} should be prime`);
    const composites = [4, 6, 8, 9, 10, 15, 21, 25, 27, 100, 121];
    for (const c of composites) assert.equal(isPrime(c), false, `${c} should be composite`);
  });

  it("isPrime handles large primes via Miller-Rabin", () => {
    // 1000003 is prime; 1000004 is not
    assert.equal(isPrime(1_000_003), true);
    assert.equal(isPrime(1_000_004), false);
    // 2147483647 (Mersenne M31) is prime
    assert.equal(isPrime(2_147_483_647), true);
  });

  it("factorize returns empty for n < 2", () => {
    assert.deepEqual(factorize(0), []);
    assert.deepEqual(factorize(1), []);
  });

  it("factorize produces canonical prime factorisations", () => {
    assert.deepEqual(factorize(12), [
      { prime: 2, exponent: 2 },
      { prime: 3, exponent: 1 },
    ]);
    assert.deepEqual(factorize(360), [
      { prime: 2, exponent: 3 },
      { prime: 3, exponent: 2 },
      { prime: 5, exponent: 1 },
    ]);
    assert.deepEqual(factorize(97), [{ prime: 97, exponent: 1 }]);
  });

  it("nextPrime returns the immediately greater prime", () => {
    assert.equal(nextPrime(0), 2);
    assert.equal(nextPrime(2), 3);
    assert.equal(nextPrime(13), 17);
    assert.equal(nextPrime(100), 101);
  });

  it("previousPrime returns the immediately lesser prime or null", () => {
    assert.equal(previousPrime(2), null);
    assert.equal(previousPrime(3), 2);
    assert.equal(previousPrime(20), 19);
    assert.equal(previousPrime(100), 97);
  });

  it("primesUpTo lists primes correctly", () => {
    assert.deepEqual(primesUpTo(20), [2, 3, 5, 7, 11, 13, 17, 19]);
    assert.deepEqual(primesUpTo(2), [2]);
    assert.deepEqual(primesUpTo(1), []);
  });
});
