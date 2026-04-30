import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { calculate, type InterestResult } from "../helpers/interest.js";

const schema = z.object({
  principal: z.number().describe("Initial principal."),
  annualRate: z.number().describe("Annual interest rate as a percentage, e.g. 5 for 5%."),
  years: z.number().describe("Number of years."),
  compoundsPerYear: z
    .number()
    .int()
    .optional()
    .describe("Compounding periods per year (compound mode only). Defaults to 12 (monthly)."),
  contributionPerPeriod: z
    .number()
    .optional()
    .describe("Optional regular contribution made each compounding period. Defaults to 0."),
  mode: z.enum(["simple", "compound"]).optional().describe("'simple' or 'compound'. Defaults to 'compound'."),
  currency: z.string().optional().describe("Currency symbol. Defaults to '$'."),
});

type Props = z.infer<typeof schema>;

interface State {
  result: InterestResult | null;
  error: string;
}

function fmt(n: number, currency: string): string {
  return `${currency}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function safeCalc(
  principal: number,
  rate: number,
  years: number,
  n: number,
  pmt: number,
  mode: "simple" | "compound",
): State {
  try {
    return {
      result: calculate({
        principal,
        annualRatePercent: rate,
        years,
        compoundsPerYear: n,
        contributionPerPeriod: pmt,
        mode,
      }),
      error: "",
    };
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : String(err) };
  }
}

const COMPOUND_PRESETS: { label: string; n: number }[] = [
  { label: "Daily", n: 365 },
  { label: "Monthly", n: 12 },
  { label: "Quarterly", n: 4 },
  { label: "Annually", n: 1 },
];

function CalculateInterest(props: Props) {
  const closeWidget = useCloseWidget();
  const [principal, setPrincipal] = useState<number>(props.principal);
  const [annualRate, setAnnualRate] = useState<number>(props.annualRate);
  const [years, setYears] = useState<number>(props.years);
  const [n, setN] = useState<number>(props.compoundsPerYear ?? 12);
  const [pmt, setPmt] = useState<number>(props.contributionPerPeriod ?? 0);
  const [mode, setMode] = useState<"simple" | "compound">(props.mode ?? "compound");
  const currency = props.currency ?? "$";

  const [state, setState] = useState<State>(() =>
    safeCalc(props.principal, props.annualRate, props.years, props.compoundsPerYear ?? 12, props.contributionPerPeriod ?? 0, props.mode ?? "compound"),
  );

  function recompute(opts?: Partial<{ p: number; r: number; t: number; n: number; pmt: number; m: "simple" | "compound" }>) {
    setState(
      safeCalc(
        opts?.p ?? principal,
        opts?.r ?? annualRate,
        opts?.t ?? years,
        opts?.n ?? n,
        opts?.pmt ?? pmt,
        opts?.m ?? mode,
      ),
    );
  }

  function onCompute() {
    recompute();
  }

  function onSetN(value: number) {
    setN(value);
    recompute({ n: value });
  }

  function onToggleMode() {
    const next: "simple" | "compound" = mode === "compound" ? "simple" : "compound";
    setMode(next);
    recompute({ m: next });
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
    const r = state.result;
    closeWidget(
      `${mode} interest on ${fmt(principal, currency)} @ ${annualRate}% for ${years} years` +
      (mode === "compound" ? ` (compounded ${n}/yr)` : "") +
      `: final ${fmt(r.finalBalance, currency)}, ` +
      `interest ${fmt(r.totalInterest, currency)}, ` +
      `total contributions ${fmt(r.totalContributions, currency)}.`,
    );
  }

  let markdown: string;
  if (state.error) {
    markdown = `**Error:** ${state.error}`;
  } else if (state.result) {
    const r = state.result;
    markdown = [
      `### 💰 Final balance: **${fmt(r.finalBalance, currency)}**`,
      ``,
      `| | |`,
      `|---|---|`,
      `| Mode | **${mode}** |`,
      `| Principal | ${fmt(r.principal, currency)} |`,
      `| Annual rate | ${annualRate}% |`,
      `| Years | ${r.years} |`,
      ...(mode === "compound" ? [`| Compounding | ${n}/year |`] : []),
      ...(pmt !== 0 ? [`| Contribution / period | ${fmt(pmt, currency)} |`] : []),
      `| Total contributions | ${fmt(r.totalContributions, currency)} |`,
      `| Total interest | **${fmt(r.totalInterest, currency)}** |`,
      ...(mode === "compound" ? [`| Effective annual rate | ${(r.effectiveAnnualRate * 100).toFixed(3)}% |`] : []),
      ``,
      `_Informational only — not financial advice._`,
    ].join("\n");
  } else {
    markdown = "_Enter values and tap **Compute**._";
  }

  return (
    <Form
      header={<CardHeader title={`Interest (${mode})`} iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Compute" onSubmit={onCompute} style="primary" />
          <Action
            title={mode === "compound" ? "Use simple" : "Use compound"}
            onAction={onToggleMode}
            style="secondary"
          />
          {COMPOUND_PRESETS.map((p) => (
            <Action key={p.label} title={p.label} onAction={() => onSetN(p.n)} style="secondary" />
          ))}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="principal"
        label="Principal"
        value={principal}
        onChange={(v) => setPrincipal(Number(v) || 0)}
      />
      <Form.NumberField
        name="annualRate"
        label="Annual rate (%)"
        value={annualRate}
        onChange={(v) => setAnnualRate(Number(v) || 0)}
      />
      <Form.NumberField
        name="years"
        label="Years"
        value={years}
        onChange={(v) => setYears(Math.max(0, Number(v) || 0))}
      />
      <Form.NumberField
        name="contributionPerPeriod"
        label="Contribution per period (optional)"
        value={pmt}
        onChange={(v) => setPmt(Number(v) || 0)}
      />
    </Form>
  );
}

const InterestCalcWidget = defineWidget({
  name: "calculate_interest",
  description:
    "Compute simple or compound interest with optional regular contributions. Compound mode supports configurable compounding (daily/monthly/quarterly/annually) and reports the effective annual rate. Pure local math; informational only — not financial advice.",
  schema,
  component: CalculateInterest,
});

export default InterestCalcWidget;
