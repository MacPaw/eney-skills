import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CheckPortWidget from "../components/check-port.js";

describe("CheckPort widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(CheckPortWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(CheckPortWidget, {
      host: "example.com",
      port: 443,
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Check action", async () => {
    const session = await createUIXTestSession(CheckPortWidget, { host: "example.com", port: 443 });

    const submitBtn = session.findWidget({ title: "Check" }) ?? session.findWidget({ title: "Checking..." });
    assert.ok(submitBtn, "should have a Check button");

    session.unmount();
  });
});
