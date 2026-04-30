import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CatFactWidget from "../components/get_cat_fact.js";

describe("Cat fact widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(CatFactWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Another One and Done actions", async () => {
    const session = await createUIXTestSession(CatFactWidget);

    assert.ok(session.findWidget({ title: "Another One" }), "should have Another One button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
