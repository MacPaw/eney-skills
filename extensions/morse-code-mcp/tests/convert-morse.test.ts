import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ConvertMorseWidget from "../components/convert-morse.js";

import { decodeMorse, encodeMorse } from "../helpers/morse.js";

describe("ConvertMorse widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(ConvertMorseWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(ConvertMorseWidget, { input: "SOS" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ConvertMorseWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("morse helpers", () => {
  it("encodes SOS", () => {
    assert.equal(encodeMorse("SOS"), "... --- ...");
  });

  it("encodes multiple words with triple-space separator", () => {
    assert.equal(encodeMorse("HI YOU"), ".... ..   -.-- --- ..-");
  });

  it("decodes back through round trip", () => {
    const encoded = encodeMorse("HELLO WORLD");
    const decoded = decodeMorse(encoded);
    assert.equal(decoded.text, "HELLO WORLD");
    assert.equal(decoded.unknownTokens.length, 0);
  });

  it("flags unknown tokens on decode", () => {
    const decoded = decodeMorse("... ......... ---");
    assert.ok(decoded.unknownTokens.includes("........."));
  });
});
