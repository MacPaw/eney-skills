import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SetClipboardWidget from "../components/set-clipboard.js";

describe("SetClipboard widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(SetClipboardWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(SetClipboardWidget, { value: "hello" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Copy action", async () => {
    const session = await createUIXTestSession(SetClipboardWidget, { value: "hello" });

    const submitBtn = session.findWidget({ title: "Copy" }) ?? session.findWidget({ title: "Copying..." });
    assert.ok(submitBtn, "should have a Copy button");

    session.unmount();
  });
});
