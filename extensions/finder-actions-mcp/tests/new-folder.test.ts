import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import NewFolderWidget from "../components/new-folder.js";

describe("NewFolder widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(NewFolderWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(NewFolderWidget, {
      parentPath: "~/Desktop",
      name: "Test",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Create action", async () => {
    const session = await createUIXTestSession(NewFolderWidget, { name: "Test" });

    const submitBtn = session.findWidget({ title: "Create" }) ?? session.findWidget({ title: "Creating..." });
    assert.ok(submitBtn, "should have a Create button");

    session.unmount();
  });
});
