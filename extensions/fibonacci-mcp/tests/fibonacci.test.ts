import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import FibonacciWidget from "../components/fibonacci.js";
import { fib, fibSequence, fibIndexOfAtLeast } from "../helpers/fib.js";

describe("Fibonacci widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(FibonacciWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Compute, N+1, mode toggle, and Done", async () => {
    const session = await createUIXTestSession(FibonacciWidget);

    assert.ok(session.findWidget({ title: "Compute" }), "Compute button");
    assert.ok(session.findWidget({ title: "N+1" }), "N+1 button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});

describe("fib helpers", () => {
  it("fib(0) and fib(1)", () => {
    assert.equal(fib(0), 0n);
    assert.equal(fib(1), 1n);
  });

  it("fib(10) = 55", () => {
    assert.equal(fib(10), 55n);
  });

  it("fib(50) matches the canonical value", () => {
    // F(50) = 12586269025
    assert.equal(fib(50), 12586269025n);
  });

  it("fib(100) is correct (BigInt-only)", () => {
    // F(100) = 354224848179261915075
    assert.equal(fib(100), 354224848179261915075n);
  });

  it("fib(1000) computes without precision loss", () => {
    const f = fib(1000);
    // F(1000) is a 209-digit number; check digit count and trailing/leading
    const s = f.toString();
    assert.equal(s.length, 209);
    assert.ok(s.startsWith("434"));
    assert.ok(s.endsWith("875"));
  });

  it("fib rejects negative or non-integer input", () => {
    assert.throws(() => fib(-1));
    assert.throws(() => fib(1.5));
  });

  it("fibSequence(5) is [0,1,1,2,3,5]", () => {
    assert.deepEqual(
      fibSequence(5).map((n) => Number(n)),
      [0, 1, 1, 2, 3, 5],
    );
  });

  it("fibIndexOfAtLeast finds the right index", () => {
    assert.equal(fibIndexOfAtLeast(0n), 0);
    assert.equal(fibIndexOfAtLeast(1n), 1);
    assert.equal(fibIndexOfAtLeast(2n), 3); // F(3) = 2
    assert.equal(fibIndexOfAtLeast(89n), 11); // F(11) = 89
    assert.equal(fibIndexOfAtLeast(100n), 12); // F(12) = 144
  });
});
