import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import YesNoWidget from "../components/yes_no_oracle.js";

describe("Yes / No Oracle widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(YesNoWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Ask again, Force buttons, and Done", async () => {
    const session = await createUIXTestSession(YesNoWidget);
    assert.ok(session.findWidget({ title: "Ask again" }), "Ask again button");
    assert.ok(session.findWidget({ title: "Force yes" }), "Force yes button");
    assert.ok(session.findWidget({ title: "Force no" }), "Force no button");
    assert.ok(session.findWidget({ title: "Force maybe" }), "Force maybe button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
