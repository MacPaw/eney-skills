import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import LookupWhoisWidget from "../components/lookup-whois.js";

describe("LookupWhois widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(LookupWhoisWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(LookupWhoisWidget, { domain: "example.com" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Lookup action", async () => {
    const session = await createUIXTestSession(LookupWhoisWidget, { domain: "example.com" });

    const submitBtn = session.findWidget({ title: "Lookup" }) ?? session.findWidget({ title: "Looking up..." });
    assert.ok(submitBtn, "should have a Lookup button");

    session.unmount();
  });
});
