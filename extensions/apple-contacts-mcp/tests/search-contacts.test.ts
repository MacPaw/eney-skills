import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SearchContactsWidget from "../components/search-contacts.js";

describe("SearchContacts widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(SearchContactsWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(SearchContactsWidget, {
      query: "Smith",
      limit: 10,
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Search action", async () => {
    const session = await createUIXTestSession(SearchContactsWidget, { query: "Smith" });

    const submitBtn = session.findWidget({ title: "Search" }) ?? session.findWidget({ title: "Searching..." });
    assert.ok(submitBtn, "should have a Search button");

    session.unmount();
  });
});
