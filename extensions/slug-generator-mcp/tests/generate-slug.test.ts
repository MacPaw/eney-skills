import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import GenerateSlugWidget from "../components/generate-slug.js";

describe("GenerateSlug widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(GenerateSlugWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(GenerateSlugWidget, {
      text: "Hello World!",
      separator: "_",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(GenerateSlugWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});
