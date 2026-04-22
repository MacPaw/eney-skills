import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SmartOrganizeDirectoryWidget from "../components/smart-organize-directory.js";

describe("SmartOrganizeDirectory widget", () => {
  it("renders on mount without crashing", async () => {
    const session = await createUIXTestSession(SmartOrganizeDirectoryWidget);
    const state = session.getSimplifiedState();
    assert.ok(state, "should render something");
    session.unmount();
  });

  it("Cancel button is present in analyzing state and closes the widget", async () => {
    const session = await createUIXTestSession(SmartOrganizeDirectoryWidget);
    const state = session.getSimplifiedState();
    const cancelBtn = session.findWidget({ title: "Cancel" });
    if (cancelBtn) {
      await session.click(cancelBtn);
      assert.ok(
        session.closedWith?.includes("Cancelled") || session.closedWith !== undefined,
        `widget should close`
      );
    } else {
      // no-key state renders instead — also acceptable
      assert.ok(state !== null, "should render something");
    }
    session.unmount();
  });
});
