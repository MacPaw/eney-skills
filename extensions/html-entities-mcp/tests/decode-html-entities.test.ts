import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import DecodeHtmlEntitiesWidget from "../components/decode-html-entities.js";

describe("DecodeHtmlEntities widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(DecodeHtmlEntitiesWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(DecodeHtmlEntitiesWidget, {
      encoded: "&lt;a&gt;&amp;hello",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(DecodeHtmlEntitiesWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});
