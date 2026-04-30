import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ChuckNorrisWidget from "../components/get_chuck_norris_joke.js";

describe("ChuckNorris widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(ChuckNorrisWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Another One and Done actions", async () => {
    const session = await createUIXTestSession(ChuckNorrisWidget);

    assert.ok(session.findWidget({ title: "Another One" }), "should have an Another One button");
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });
});
