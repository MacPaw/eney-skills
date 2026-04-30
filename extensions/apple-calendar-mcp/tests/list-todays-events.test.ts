import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ListTodaysEventsWidget from "../components/list-todays-events.js";

describe("ListTodaysEvents widget", () => {
  it("renders a form in loading state", async () => {
    const session = await createUIXTestSession(ListTodaysEventsWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ListTodaysEventsWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});
