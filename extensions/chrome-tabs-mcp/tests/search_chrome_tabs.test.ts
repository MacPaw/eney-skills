import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ChromeTabsWidget from "../components/search_chrome_tabs.js";

describe("Chrome tabs widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(ChromeTabsWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Search, source toggles, activate, and Done", async () => {
    const session = await createUIXTestSession(ChromeTabsWidget);
    assert.ok(session.findWidget({ title: "Search" }), "Search button");
    assert.ok(session.findWidget({ title: "Tabs" }), "Tabs source");
    assert.ok(session.findWidget({ title: "Bookmarks" }), "Bookmarks source");
    assert.ok(session.findWidget({ title: "Activate first match" }), "Activate button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
