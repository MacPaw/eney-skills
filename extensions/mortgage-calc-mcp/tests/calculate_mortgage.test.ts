import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MortgageCalcWidget from "../components/calculate_mortgage.js";
import { calculate, amortizationSchedule } from "../helpers/mortgage.js";

describe("Mortgage calculator widget", () => {
  it("renders with required props", async () => {
    const session = await createUIXTestSession(MortgageCalcWidget, {
      principal: 300000,
      annualRate: 6.5,
      termYears: 30,
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Compute, Show schedule, and Done", async () => {
    const session = await createUIXTestSession(MortgageCalcWidget, {
      principal: 300000,
      annualRate: 6.5,
      termYears: 30,
    });

    assert.ok(session.findWidget({ title: "Compute" }), "Compute button");
    assert.ok(session.findWidget({ title: "Show schedule" }), "Show schedule button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});

describe("mortgage calculate helper", () => {
  it("$300k @ 6.5% / 30y → ~$1896.20/mo", () => {
    const r = calculate({
      principal: 300_000,
      annualRatePercent: 6.5,
      termYears: 30,
    });
    // Expected ~1896.20 (rounded). Allow ±0.05 tolerance.
    assert.ok(Math.abs(r.monthlyPayment - 1896.2) < 0.05, `got ${r.monthlyPayment}`);
    assert.equal(r.termMonths, 360);
    assert.equal(r.financed, 300_000);
  });

  it("zero-rate loan: payment = principal / months", () => {
    const r = calculate({
      principal: 12_000,
      annualRatePercent: 0,
      termYears: 1,
    });
    assert.equal(r.monthlyPayment, 1000);
    assert.equal(r.totalPaid, 12_000);
    assert.equal(r.totalInterest, 0);
  });

  it("subtracts down payment from financed amount", () => {
    const r = calculate({
      principal: 400_000,
      annualRatePercent: 5,
      termYears: 30,
      downPayment: 80_000,
    });
    assert.equal(r.financed, 320_000);
  });

  it("rejects invalid inputs", () => {
    assert.throws(() => calculate({ principal: 0, annualRatePercent: 5, termYears: 30 }));
    assert.throws(() => calculate({ principal: 100_000, annualRatePercent: -1, termYears: 30 }));
    assert.throws(() => calculate({ principal: 100_000, annualRatePercent: 5, termYears: 0 }));
    assert.throws(() =>
      calculate({ principal: 100_000, annualRatePercent: 5, termYears: 30, downPayment: 200_000 }),
    );
  });

  it("amortizationSchedule rows sum approximately to monthly payment each", () => {
    const rows = amortizationSchedule(
      { principal: 300_000, annualRatePercent: 6.5, termYears: 30 },
      6,
    );
    const r = calculate({ principal: 300_000, annualRatePercent: 6.5, termYears: 30 });
    for (const row of rows) {
      const total = row.interest + row.principal;
      assert.ok(Math.abs(total - r.monthlyPayment) < 0.001);
    }
    assert.equal(rows.length, 6);
  });
});
