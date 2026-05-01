import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MdnSearchWidget from "../components/search_mdn.js";

describe("MDN search widget", () => {
  it("renders a form when given a query", async () => {
    const session = await createUIXTestSession(MdnSearchWidget, { query: "fetch" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Search, locale buttons, and Done", async () => {
    const session = await createUIXTestSession(MdnSearchWidget, { query: "array" });
    assert.ok(session.findWidget({ title: "Search" }), "Search button");
    assert.ok(session.findWidget({ title: "en-US" }), "en-US locale");
    assert.ok(session.findWidget({ title: "fr" }), "fr locale");
    assert.ok(session.findWidget({ title: "ja" }), "ja locale");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
