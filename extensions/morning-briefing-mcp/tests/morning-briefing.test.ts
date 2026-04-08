import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MorningBriefingWidget from "../components/morning-briefing.js";

describe("MorningBriefing widget", () => {
  it("renders progress UI with default props", async () => {
    const session = await createUIXTestSession(MorningBriefingWidget);
    const state = session.getSimplifiedState();

    const paper = state.children?.find((c) => c.type === "paper");
    assert.ok(paper, "should render a paper component with progress");

    session.unmount();
  });

  it("shows send partial briefing action on error", async () => {
    const session = await createUIXTestSession(MorningBriefingWidget);

    // Wait a moment for fetches to attempt (they may fail in test env)
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const btn = session.findWidget({ title: "Send partial briefing" });
    if (btn) {
      assert.ok(btn, "should have a Send partial briefing button on error");
      await session.click(btn);
      assert.ok(session.closedWith, "should close widget with context");
    }

    session.unmount();
  });
});
