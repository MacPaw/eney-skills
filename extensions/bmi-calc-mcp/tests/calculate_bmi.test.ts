import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import BMIWidget from "../components/calculate_bmi.js";

describe("BMI calculator widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(BMIWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Done action", async () => {
    const session = await createUIXTestSession(BMIWidget);
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");
    session.unmount();
  });

  it("has unit toggle action", async () => {
    const session = await createUIXTestSession(BMIWidget);
    const toggle = session.findWidget({ title: "Switch to Imperial" });
    assert.ok(toggle, "should have a unit toggle button");
    session.unmount();
  });
});
