import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import HackerNewsWidget from "../components/show_hacker_news.js";

describe("Hacker News widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(HackerNewsWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh, feed buttons, and Done", async () => {
    const session = await createUIXTestSession(HackerNewsWidget);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Top" }), "Top feed");
    assert.ok(session.findWidget({ title: "New" }), "New feed");
    assert.ok(session.findWidget({ title: "Best" }), "Best feed");
    assert.ok(session.findWidget({ title: "Ask" }), "Ask feed");
    assert.ok(session.findWidget({ title: "Show" }), "Show feed");
    assert.ok(session.findWidget({ title: "Jobs" }), "Jobs feed");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
