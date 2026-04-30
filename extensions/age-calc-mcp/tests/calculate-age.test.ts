import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CalculateAgeWidget from "../components/calculate-age.js";

import { spanBetween } from "../helpers/age.js";

describe("CalculateAge widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(CalculateAgeWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(CalculateAgeWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("spanBetween helper", () => {
  it("computes a whole-year span", () => {
    const s = spanBetween(new Date("1990-01-15"), new Date("2025-01-15"));
    assert.deepEqual({ y: s.years, m: s.months, d: s.days }, { y: 35, m: 0, d: 0 });
  });

  it("borrows from months when day-of-month rolls under", () => {
    const s = spanBetween(new Date("2025-12-15"), new Date("2026-03-01"));
    assert.equal(s.years, 0);
    assert.equal(s.months, 2);
    assert.ok(s.days >= 14 && s.days <= 17, `expected ~14-17 days, got ${s.days}`);
  });

  it("flags direction", () => {
    assert.equal(spanBetween(new Date("2020-01-01"), new Date("2025-01-01")).direction, "past");
    assert.equal(spanBetween(new Date("2030-01-01"), new Date("2025-01-01")).direction, "future");
    assert.equal(spanBetween(new Date("2025-01-01"), new Date("2025-01-01")).direction, "same");
  });
});
