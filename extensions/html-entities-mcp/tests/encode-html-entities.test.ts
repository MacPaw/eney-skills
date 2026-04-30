import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import EncodeHtmlEntitiesWidget from "../components/encode-html-entities.js";

describe("EncodeHtmlEntities widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(EncodeHtmlEntitiesWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(EncodeHtmlEntitiesWidget, {
      text: "<a>&hello",
      numeric: true,
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(EncodeHtmlEntitiesWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});
