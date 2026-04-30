import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import AddEventWidget from "../components/add-event.js";

describe("AddEvent widget", () => {
  it("renders a form in loading state", async () => {
    const session = await createUIXTestSession(AddEventWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(AddEventWidget, {
      summary: "Lunch",
      calendar: "Home",
      location: "Cafe",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has an Add Event action", async () => {
    const session = await createUIXTestSession(AddEventWidget);

    const submitBtn =
      session.findWidget({ title: "Add Event" }) ?? session.findWidget({ title: "Adding..." });
    assert.ok(submitBtn, "should have an Add Event button");

    session.unmount();
  });
});
