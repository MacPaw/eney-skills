import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SpdxWidget from "../components/lookup_spdx_license.js";

describe("SPDX license widget", () => {
  it("renders a form when given an id", async () => {
    const session = await createUIXTestSession(SpdxWidget, { id: "MIT" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up, presets, and Done", async () => {
    const session = await createUIXTestSession(SpdxWidget, { id: "MIT" });
    assert.ok(session.findWidget({ title: "Look Up" }), "Look Up button");
    assert.ok(session.findWidget({ title: "MIT" }), "MIT preset");
    assert.ok(session.findWidget({ title: "Apache-2.0" }), "Apache-2.0 preset");
    assert.ok(session.findWidget({ title: "GPL-3.0-only" }), "GPL-3.0-only preset");
    assert.ok(session.findWidget({ title: "BSD-3-Clause" }), "BSD-3-Clause preset");
    assert.ok(session.findWidget({ title: "ISC" }), "ISC preset");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
