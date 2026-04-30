import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import OpenInFinderWidget from "../components/open-in-finder.js";

describe("OpenInFinder widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(OpenInFinderWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(OpenInFinderWidget, { path: "~/Desktop", reveal: false });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has an Open action", async () => {
    const session = await createUIXTestSession(OpenInFinderWidget, { path: "~/Desktop" });

    const submitBtn =
      session.findWidget({ title: "Open" }) ??
      session.findWidget({ title: "Reveal" }) ??
      session.findWidget({ title: "Opening..." });
    assert.ok(submitBtn, "should have an Open or Reveal button");

    session.unmount();
  });
});
