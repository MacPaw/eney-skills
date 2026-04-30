import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ValidateLuhnWidget from "../components/validate-luhn.js";

import { evaluate } from "../helpers/luhn.js";

describe("ValidateLuhn widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(ValidateLuhnWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(ValidateLuhnWidget, { number: "4242 4242 4242 4242" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ValidateLuhnWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("luhn helper", () => {
  it("validates a known-good test number", () => {
    const r = evaluate("4242 4242 4242 4242");
    assert.equal(r.isValid, true);
  });

  it("flags an invalid number and computes the missing check digit", () => {
    const r = evaluate("4242 4242 4242 4241");
    assert.equal(r.isValid, false);
    assert.equal(r.checkDigit, 2);
    assert.equal(r.suggestedFullNumber, "4242424242424242");
  });

  it("strips spaces and dashes", () => {
    assert.equal(evaluate("4242-4242-4242-4242").digits, "4242424242424242");
  });

  it("rejects non-digit input", () => {
    assert.throws(() => evaluate("4242 abc"));
  });
});
