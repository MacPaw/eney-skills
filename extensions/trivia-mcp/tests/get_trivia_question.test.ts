import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import TriviaWidget from "../components/get_trivia_question.js";

describe("Trivia widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(TriviaWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Another Question and Done actions", async () => {
    const session = await createUIXTestSession(TriviaWidget);

    assert.ok(
      session.findWidget({ title: "Another Question" }),
      "should have an Another Question button",
    );
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });
});
