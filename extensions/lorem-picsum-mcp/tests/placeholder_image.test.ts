import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import PicsumWidget from "../components/placeholder_image.js";

describe("Lorem Picsum widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(PicsumWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Generate, presets, toggles, and Done", async () => {
    const session = await createUIXTestSession(PicsumWidget);

    assert.ok(session.findWidget({ title: "Generate" }), "Generate button");
    assert.ok(session.findWidget({ title: "16:9 (1280×720)" }), "16:9 preset");
    assert.ok(session.findWidget({ title: "Square (600)" }), "Square preset");
    assert.ok(session.findWidget({ title: "Avatar (256)" }), "Avatar preset");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });

  it("uses seed when provided", async () => {
    const session = await createUIXTestSession(PicsumWidget, { seed: "myseed", width: 200, height: 150 });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/picsum\.photos\/seed\/myseed/.test(dump), "URL should contain the seed path");
    session.unmount();
  });
});
