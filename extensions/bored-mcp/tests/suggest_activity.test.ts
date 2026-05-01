import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import BoredWidget from "../components/suggest_activity.js";

describe("Bored activity widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(BoredWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Another idea and Done actions", async () => {
    const session = await createUIXTestSession(BoredWidget);
    assert.ok(session.findWidget({ title: "Another idea" }), "Another idea button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
