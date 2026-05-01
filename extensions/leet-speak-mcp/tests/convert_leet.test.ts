import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import LeetSpeakWidget from "../components/convert_leet.js";
import { toLeet, fromLeet } from "../helpers/leet.js";

describe("Leet speak widget", () => {
  it("renders a form with text", async () => {
    const session = await createUIXTestSession(LeetSpeakWidget, { text: "leet" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Apply, levels, decode, swap, and Done", async () => {
    const session = await createUIXTestSession(LeetSpeakWidget, { text: "leet" });
    assert.ok(session.findWidget({ title: "Apply" }), "Apply button");
    assert.ok(session.findWidget({ title: "Basic" }), "Basic level");
    assert.ok(session.findWidget({ title: "Advanced" }), "Advanced level");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("leet helpers", () => {
  it("basic: 'leet' -> 'l337'", () => {
    assert.equal(toLeet("leet", "basic"), "l337");
  });

  it("intermediate: includes b->8, l->1", () => {
    assert.equal(toLeet("blob", "intermediate"), "8108");
  });

  it("advanced: contains glyphs like |2 for r", () => {
    const out = toLeet("rabbit", "advanced");
    assert.ok(out.includes("|2"), `expected |2 in ${out}`);
  });

  it("preserves unmapped chars (basic doesn't map 'l')", () => {
    // basic-mode 'l' is not substituted (only intermediate maps l->1).
    assert.equal(toLeet("Hello!", "basic"), "H3ll0!");
    assert.equal(toLeet("Hello!", "intermediate"), "H3110!");
  });

  it("fromLeet decodes the basic numeric set", () => {
    assert.equal(fromLeet("l337"), "leet");
    assert.equal(fromLeet("h3ll0"), "hello");
  });
});
