// Standard amortising mortgage math.
// Monthly payment formula: M = P * r(1+r)^n / ((1+r)^n - 1)
//   where P = principal, r = monthly rate (annualRate/12/100), n = term in months.

export interface MortgageInput {
  principal: number;
  annualRatePercent: number;
  termYears: number;
  downPayment?: number;
}

export interface MortgageResult {
  financed: number;
  monthlyPayment: number;
  totalPaid: number;
  totalInterest: number;
  termMonths: number;
  monthlyRate: number;
}

export function calculate({
  principal,
  annualRatePercent,
  termYears,
  downPayment = 0,
}: MortgageInput): MortgageResult {
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("Principal must be a positive number.");
  }
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
    throw new Error("Annual rate must be a non-negative percentage.");
  }
  if (!Number.isFinite(termYears) || termYears <= 0) {
    throw new Error("Term in years must be positive.");
  }
  if (downPayment < 0 || downPayment >= principal) {
    throw new Error("Down payment must be ≥ 0 and < principal.");
  }
  const financed = principal - downPayment;
  const termMonths = Math.round(termYears * 12);
  const monthlyRate = annualRatePercent / 100 / 12;

  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = financed / termMonths;
  } else {
    const x = Math.pow(1 + monthlyRate, termMonths);
    monthlyPayment = (financed * monthlyRate * x) / (x - 1);
  }

  const totalPaid = monthlyPayment * termMonths;
  const totalInterest = totalPaid - financed;

  return {
    financed,
    monthlyPayment,
    totalPaid,
    totalInterest,
    termMonths,
    monthlyRate,
  };
}

export interface AmortRow {
  month: number;
  interest: number;
  principal: number;
  balance: number;
}

// First N rows of the amortisation schedule.
export function amortizationSchedule(
  input: MortgageInput,
  rows = 12,
): AmortRow[] {
  const r = calculate(input);
  const out: AmortRow[] = [];
  let balance = r.financed;
  const limit = Math.min(rows, r.termMonths);
  for (let m = 1; m <= limit; m++) {
    const interest = balance * r.monthlyRate;
    const principalPaid = r.monthlyPayment - interest;
    balance = Math.max(0, balance - principalPaid);
    out.push({ month: m, interest, principal: principalPaid, balance });
  }
  return out;
}

export function computePayoffDate(termMonths: number, startDate = new Date()): Date {
  const d = new Date(startDate.getTime());
  d.setMonth(d.getMonth() + termMonths);
  return d;
}
