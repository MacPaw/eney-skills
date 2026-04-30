import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import EvaluateExpressionWidget from "../components/evaluate-expression.js";

import { evaluateExpression } from "../helpers/eval.js";

describe("EvaluateExpression widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(EvaluateExpressionWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(EvaluateExpressionWidget, {
      expression: "2*(3+4)",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(EvaluateExpressionWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("evaluateExpression helper", () => {
  it("handles arithmetic", () => {
    assert.equal(evaluateExpression("2 + 3 * 4"), 14);
    assert.equal(evaluateExpression("(1 + 2) * 3"), 9);
  });

  it("handles power and functions", () => {
    assert.equal(evaluateExpression("2^10"), 1024);
    assert.equal(evaluateExpression("sqrt(144)"), 12);
    assert.equal(evaluateExpression("abs(-5)"), 5);
  });

  it("rejects unknown identifiers", () => {
    assert.throws(() => evaluateExpression("foo + 1"));
  });

  it("rejects code injection attempts", () => {
    assert.throws(() => evaluateExpression("process.exit"));
    assert.throws(() => evaluateExpression("globalThis"));
  });
});
