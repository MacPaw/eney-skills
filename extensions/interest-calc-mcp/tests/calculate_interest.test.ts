import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import InterestCalcWidget from "../components/calculate_interest.js";
import { calculate } from "../helpers/interest.js";

describe("Interest calculator widget", () => {
  it("renders a form with required props", async () => {
    const session = await createUIXTestSession(InterestCalcWidget, {
      principal: 1000,
      annualRate: 5,
      years: 10,
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Compute, mode toggle, presets, and Done", async () => {
    const session = await createUIXTestSession(InterestCalcWidget, {
      principal: 1000,
      annualRate: 5,
      years: 10,
    });

    assert.ok(session.findWidget({ title: "Compute" }), "Compute button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    assert.ok(session.findWidget({ title: "Daily" }), "Daily preset");
    assert.ok(session.findWidget({ title: "Monthly" }), "Monthly preset");
    assert.ok(session.findWidget({ title: "Annually" }), "Annually preset");

    session.unmount();
  });
});

describe("interest calculate helper", () => {
  it("simple interest: 1000 @ 5% / 2y = 1100", () => {
    const r = calculate({
      principal: 1000,
      annualRatePercent: 5,
      years: 2,
      mode: "simple",
    });
    assert.equal(r.finalBalance, 1100);
    assert.equal(r.totalInterest, 100);
  });

  it("compound monthly: 1000 @ 5% / 10y ≈ 1647.01", () => {
    const r = calculate({
      principal: 1000,
      annualRatePercent: 5,
      years: 10,
      compoundsPerYear: 12,
    });
    assert.ok(Math.abs(r.finalBalance - 1647.01) < 0.05, `got ${r.finalBalance}`);
  });

  it("compound annual: 1000 @ 10% / 10y = 1000·1.10^10 ≈ 2593.74", () => {
    const r = calculate({
      principal: 1000,
      annualRatePercent: 10,
      years: 10,
      compoundsPerYear: 1,
    });
    assert.ok(Math.abs(r.finalBalance - 2593.74) < 0.05);
  });

  it("zero rate compound: contributions accumulate linearly", () => {
    const r = calculate({
      principal: 0,
      annualRatePercent: 0,
      years: 5,
      compoundsPerYear: 12,
      contributionPerPeriod: 100,
    });
    assert.equal(r.finalBalance, 6000);
    assert.equal(r.totalInterest, 0);
  });

  it("compound with monthly contributions: $0 + $100/mo @ 6% / 10y", () => {
    // Future value of annuity: PMT * ((1+i)^n - 1)/i, i=0.06/12, n=120
    const r = calculate({
      principal: 0,
      annualRatePercent: 6,
      years: 10,
      compoundsPerYear: 12,
      contributionPerPeriod: 100,
    });
    // Standard answer: $16,387.93
    assert.ok(Math.abs(r.finalBalance - 16_387.93) < 0.5, `got ${r.finalBalance}`);
  });

  it("rejects invalid input", () => {
    assert.throws(() =>
      calculate({ principal: -100, annualRatePercent: 5, years: 5 }),
    );
    assert.throws(() =>
      calculate({ principal: 100, annualRatePercent: 5, years: -5 }),
    );
  });

  it("effective annual rate ≈ nominal when compounded annually", () => {
    const r = calculate({
      principal: 1000,
      annualRatePercent: 5,
      years: 1,
      compoundsPerYear: 1,
    });
    assert.ok(Math.abs(r.effectiveAnnualRate - 0.05) < 1e-9);
  });
});
