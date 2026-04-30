import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import AddReminderWidget from "../components/add-reminder.js";

describe("AddReminder widget", () => {
  it("renders a form in loading state", async () => {
    const session = await createUIXTestSession(AddReminderWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(AddReminderWidget, {
      name: "Buy milk",
      list: "Reminders",
      body: "2 liters",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has an Add Reminder action", async () => {
    const session = await createUIXTestSession(AddReminderWidget);

    const submitBtn =
      session.findWidget({ title: "Add Reminder" }) ?? session.findWidget({ title: "Adding..." });
    assert.ok(submitBtn, "should have an Add Reminder button");

    session.unmount();
  });
});
