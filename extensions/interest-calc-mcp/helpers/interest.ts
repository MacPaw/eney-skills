// Interest math helpers.
// Simple interest:    A = P (1 + r·t)
// Compound interest:  A = P (1 + r/n)^(n·t)
// With contributions: A = P(1+r/n)^(nt) + PMT·[((1+r/n)^(nt) - 1) / (r/n)]
//   (assumes contributions made at the end of each compounding period; r=0 handled separately)

export interface InterestInput {
  principal: number;
  annualRatePercent: number;
  years: number;
  compoundsPerYear?: number; // default 12 for compound; ignored for simple
  contributionPerPeriod?: number; // default 0
  mode?: "simple" | "compound";
}

export interface InterestResult {
  finalBalance: number;
  totalContributions: number;
  totalInterest: number;
  principal: number;
  years: number;
  effectiveAnnualRate: number;
}

export function calculate(input: InterestInput): InterestResult {
  const { principal, annualRatePercent, years } = input;
  const mode = input.mode ?? "compound";
  const n = mode === "simple" ? 1 : Math.max(1, input.compoundsPerYear ?? 12);
  const pmt = input.contributionPerPeriod ?? 0;

  if (!Number.isFinite(principal) || principal < 0) {
    throw new Error("Principal must be a non-negative number.");
  }
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < -100) {
    throw new Error("Annual rate must be a finite number ≥ -100%.");
  }
  if (!Number.isFinite(years) || years < 0) {
    throw new Error("Years must be a non-negative number.");
  }

  const r = annualRatePercent / 100;

  let finalBalance: number;
  let totalContributions = principal;

  if (mode === "simple") {
    finalBalance = principal * (1 + r * years) + pmt * years * 1;
    totalContributions = principal + pmt * years * 1;
  } else {
    const periods = n * years;
    const periodicRate = r / n;
    const growth = Math.pow(1 + periodicRate, periods);
    let balance = principal * growth;
    let pmtComponent: number;
    if (Math.abs(periodicRate) < 1e-12) {
      pmtComponent = pmt * periods;
    } else {
      pmtComponent = (pmt * (growth - 1)) / periodicRate;
    }
    balance += pmtComponent;
    finalBalance = balance;
    totalContributions = principal + pmt * periods;
  }

  const totalInterest = finalBalance - totalContributions;
  const effectiveAnnualRate =
    mode === "compound" ? Math.pow(1 + r / n, n) - 1 : r;

  return {
    finalBalance,
    totalContributions,
    totalInterest,
    principal,
    years,
    effectiveAnnualRate,
  };
}
