import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import Rot13Widget from "../components/rot13_cipher.js";
import { caesar, rot13 } from "../helpers/cipher.js";

describe("ROT13 widget", () => {
  it("renders a form with text input", async () => {
    const session = await createUIXTestSession(Rot13Widget, { text: "Hello" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Apply, ROT13, ROT5, ROT47, and Done actions", async () => {
    const session = await createUIXTestSession(Rot13Widget, { text: "Hi" });

    assert.ok(session.findWidget({ title: "Apply" }), "should have Apply button");
    assert.ok(session.findWidget({ title: "ROT13" }), "should have ROT13 button");
    assert.ok(session.findWidget({ title: "ROT5" }), "should have ROT5 button");
    assert.ok(session.findWidget({ title: "ROT47" }), "should have ROT47 button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});

describe("caesar helper", () => {
  it("ROT13 of 'Hello, World!' is 'Uryyb, Jbeyq!'", () => {
    assert.equal(rot13("Hello, World!"), "Uryyb, Jbeyq!");
  });

  it("ROT13 is its own inverse", () => {
    const original = "The quick brown fox jumps over the lazy dog. 0123";
    assert.equal(rot13(rot13(original)), original);
  });

  it("preserves case", () => {
    assert.equal(rot13("AbCdE"), "NoPqR");
  });

  it("leaves non-alphabetic characters unchanged by default", () => {
    assert.equal(rot13("a 1 z"), "n 1 m");
  });

  it("shifts digits when shiftDigits=true (ROT5 with shift 5)", () => {
    assert.equal(caesar("abc 12345", { shift: 5, shiftDigits: true }), "fgh 67890");
  });

  it("handles negative shifts", () => {
    assert.equal(caesar("Hello", { shift: -1, shiftDigits: false }), "Gdkkn");
  });

  it("handles large shifts via modulo", () => {
    // shift 26 = identity for letters
    assert.equal(caesar("Hello", { shift: 26, shiftDigits: false }), "Hello");
    // shift 27 = ROT1
    assert.equal(caesar("abc", { shift: 27, shiftDigits: false }), "bcd");
  });
});
