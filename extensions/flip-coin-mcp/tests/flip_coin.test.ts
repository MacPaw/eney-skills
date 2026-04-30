import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import FlipCoinWidget from "../components/flip_coin.js";

describe("Coin flip widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(FlipCoinWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Flip, Flip again, Flip 100, and Done", async () => {
    const session = await createUIXTestSession(FlipCoinWidget);

    assert.ok(session.findWidget({ title: "Flip" }), "Flip button");
    assert.ok(session.findWidget({ title: "Flip again" }), "Flip again button");
    assert.ok(session.findWidget({ title: "Flip 100" }), "Flip 100 button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });

  it("renders Heads or Tails for single flip", async () => {
    const session = await createUIXTestSession(FlipCoinWidget, { count: 1 });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/Heads|Tails/.test(dump), "should render Heads or Tails");
    session.unmount();
  });

  it("multi-flip with count=100 shows 100 in output", async () => {
    const session = await createUIXTestSession(FlipCoinWidget, { count: 100 });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/100/.test(dump), "should mention 100 flips");
    session.unmount();
  });
});
