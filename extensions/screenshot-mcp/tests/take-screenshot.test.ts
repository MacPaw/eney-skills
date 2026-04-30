import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import TakeScreenshotWidget from "../components/take-screenshot.js";

describe("TakeScreenshot widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(TakeScreenshotWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(TakeScreenshotWidget, {
      mode: "window",
      format: "jpg",
      delay: 3,
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Take Screenshot action", async () => {
    const session = await createUIXTestSession(TakeScreenshotWidget);

    const submitBtn =
      session.findWidget({ title: "Take Screenshot" }) ?? session.findWidget({ title: "Capturing..." });
    assert.ok(submitBtn, "should have a Take Screenshot button");

    session.unmount();
  });
});
