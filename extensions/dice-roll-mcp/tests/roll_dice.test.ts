import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import RollDiceWidget from "../components/roll_dice.js";

describe("Dice roller widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(RollDiceWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Roll, Roll Again, and Done actions", async () => {
    const session = await createUIXTestSession(RollDiceWidget);

    assert.ok(session.findWidget({ title: "Roll" }), "should have a Roll button");
    assert.ok(session.findWidget({ title: "Roll Again" }), "should have a Roll Again button");
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });

  it("renders preset buttons", async () => {
    const session = await createUIXTestSession(RollDiceWidget);

    assert.ok(session.findWidget({ title: "1d20" }), "should have 1d20 preset");
    assert.ok(session.findWidget({ title: "2d6" }), "should have 2d6 preset");

    session.unmount();
  });
});
