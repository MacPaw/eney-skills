import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  calculate,
  amortizationSchedule,
  computePayoffDate,
  type MortgageResult,
} from "../helpers/mortgage.js";

const schema = z.object({
  principal: z.number().describe("Total purchase price (or loan principal if no down payment)."),
  annualRate: z.number().describe("Annual interest rate as a percentage, e.g. 6.5 for 6.5%."),
  termYears: z.number().describe("Loan term in years, e.g. 30."),
  downPayment: z.number().optional().describe("Optional down payment (in same units as principal)."),
  currency: z.string().optional().describe("Currency symbol or code, e.g. '$', '€', 'USD'. Defaults to '$'."),
});

type Props = z.infer<typeof schema>;

interface State {
  result: MortgageResult | null;
  error: string;
}

function fmt(n: number, currency: string): string {
  return `${currency}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeCalc(p: number, r: number, t: number, d: number): State {
  try {
    return {
      result: calculate({
        principal: p,
        annualRatePercent: r,
        termYears: t,
        downPayment: d,
      }),
      error: "",
    };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function CalculateMortgage(props: Props) {
  const closeWidget = useCloseWidget();
  const [principal, setPrincipal] = useState<number>(props.principal);
  const [annualRate, setAnnualRate] = useState<number>(props.annualRate);
  const [termYears, setTermYears] = useState<number>(props.termYears);
  const [downPayment, setDownPayment] = useState<number>(props.downPayment ?? 0);
  const currency = props.currency ?? "$";

  const [state, setState] = useState<State>(() =>
    safeCalc(props.principal, props.annualRate, props.termYears, props.downPayment ?? 0),
  );
  const [showSchedule, setShowSchedule] = useState(false);

  function recompute(opts?: Partial<{ p: number; r: number; t: number; d: number }>) {
    const p = opts?.p ?? principal;
    const r = opts?.r ?? annualRate;
    const t = opts?.t ?? termYears;
    const d = opts?.d ?? downPayment;
    setState(safeCalc(p, r, t, d));
  }

  function onCompute() {
    setShowSchedule(false);
    recompute();
  }

  function onSchedule() {
    setShowSchedule(true);
    recompute();
  }

  function onDone() {
    if (state.error) {
      closeWidget(`Error: ${state.error}`);
      return;
    }
    if (!state.result) {
      closeWidget("No result.");
      return;
    }
    closeWidget(
      `Mortgage on ${fmt(principal, currency)} financed at ${annualRate}% for ${termYears} years: ` +
      `monthly payment ${fmt(state.result.monthlyPayment, currency)}; ` +
      `total paid ${fmt(state.result.totalPaid, currency)}; ` +
      `total interest ${fmt(state.result.totalInterest, currency)}.`,
    );
  }

  let markdown: string;
  if (state.error) {
    markdown = `**Error:** ${state.error}`;
  } else if (state.result) {
    const r = state.result;
    const payoff = computePayoffDate(r.termMonths)
      .toISOString()
      .slice(0, 10);
    const lines = [
      `### 💰 Monthly payment: **${fmt(r.monthlyPayment, currency)}**`,
      ``,
      `| | |`,
      `|---|---|`,
      `| Financed | ${fmt(r.financed, currency)} (price ${fmt(principal, currency)}${downPayment ? `, down ${fmt(downPayment, currency)}` : ""}) |`,
      `| Term | ${termYears} years (${r.termMonths} months) |`,
      `| Annual rate | ${annualRate}% |`,
      `| Total paid | ${fmt(r.totalPaid, currency)} |`,
      `| Total interest | ${fmt(r.totalInterest, currency)} |`,
      `| Payoff date | ~${payoff} |`,
      ``,
    ];
    if (showSchedule) {
      const schedule = amortizationSchedule(
        {
          principal,
          annualRatePercent: annualRate,
          termYears,
          downPayment,
        },
        12,
      );
      lines.push(`**First ${schedule.length} payments:**`);
      lines.push("");
      lines.push("| # | Interest | Principal | Balance |");
      lines.push("|---|---|---|---|");
      for (const row of schedule) {
        lines.push(
          `| ${row.month} | ${fmt(row.interest, currency)} | ${fmt(row.principal, currency)} | ${fmt(row.balance, currency)} |`,
        );
      }
    }
    lines.push("");
    lines.push(
      "_Informational only — not financial advice. Real loans include taxes, insurance, fees, and may use different compounding._",
    );
    markdown = lines.join("\n");
  } else {
    markdown = "_Enter loan details and tap **Compute**._";
  }

  return (
    <Form
      header={<CardHeader title="Mortgage Calculator" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Compute" onSubmit={onCompute} style="primary" />
          <Action title="Show schedule" onAction={onSchedule} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="principal"
        label="Principal / purchase price"
        value={principal}
        onChange={(v) => setPrincipal(Number(v) || 0)}
      />
      <Form.NumberField
        name="downPayment"
        label="Down payment (optional)"
        value={downPayment}
        onChange={(v) => setDownPayment(Math.max(0, Number(v) || 0))}
      />
      <Form.NumberField
        name="annualRate"
        label="Annual rate (%)"
        value={annualRate}
        onChange={(v) => setAnnualRate(Number(v) || 0)}
      />
      <Form.NumberField
        name="termYears"
        label="Term (years)"
        value={termYears}
        onChange={(v) => setTermYears(Number(v) || 0)}
      />
    </Form>
  );
}

const MortgageCalcWidget = defineWidget({
  name: "calculate_mortgage",
  description:
    "Compute mortgage monthly payment, total paid, total interest, and amortisation schedule using the standard formula M = P·r(1+r)^n / ((1+r)^n - 1). Pure math — informational only, not financial advice; real loans include taxes/insurance/fees.",
  schema,
  component: CalculateMortgage,
});

export default MortgageCalcWidget;
