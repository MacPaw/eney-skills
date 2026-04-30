import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import BirthdayCountdownWidget from "../components/birthday_countdown.js";

describe("Birthday countdown widget", () => {
  it("renders a form when given a birthday", async () => {
    const session = await createUIXTestSession(BirthdayCountdownWidget, {
      birthday: "1990-05-15",
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Calculate and Done actions", async () => {
    const session = await createUIXTestSession(BirthdayCountdownWidget, {
      birthday: "12-25",
    });

    assert.ok(session.findWidget({ title: "Calculate" }), "Calculate button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });

  it("renders error for invalid input", async () => {
    const session = await createUIXTestSession(BirthdayCountdownWidget, {
      birthday: "not a date",
    });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/Error/i.test(dump), "should show error message");
    session.unmount();
  });
});
