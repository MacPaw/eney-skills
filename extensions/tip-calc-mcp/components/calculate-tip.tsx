import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  bill: z.number().optional().describe("Bill amount before tip."),
  tipPercent: z.number().optional().describe("Tip percentage. Defaults to 18."),
  people: z.number().int().optional().describe("Number of people splitting. Defaults to 1."),
  roundUp: z.boolean().optional().describe("Round each person's share up to the next whole unit. Defaults to false."),
  currency: z.string().optional().describe("Currency symbol shown in output. Defaults to '$'."),
});

type Props = z.infer<typeof schema>;

interface Calc {
  bill: number;
  tip: number;
  total: number;
  perPerson: number;
  roundedPerPerson: number;
  roundedTotal: number;
}

function format(n: number, currency: string): string {
  return `${currency}${n.toFixed(2)}`;
}

function compute(bill: number, tipPercent: number, people: number, roundUp: boolean): Calc {
  const tip = (bill * tipPercent) / 100;
  const total = bill + tip;
  const perPerson = total / people;
  const roundedPerPerson = roundUp ? Math.ceil(perPerson) : perPerson;
  const roundedTotal = roundedPerPerson * people;
  return { bill, tip, total, perPerson, roundedPerPerson, roundedTotal };
}

function CalculateTip(props: Props) {
  const closeWidget = useCloseWidget();
  const [bill, setBill] = useState<number | null>(props.bill ?? null);
  const [tipPercent, setTipPercent] = useState<number | null>(props.tipPercent ?? 18);
  const [people, setPeople] = useState<number | null>(props.people ?? 1);
  const [roundUp, setRoundUp] = useState(props.roundUp ?? false);
  const [currency, setCurrency] = useState(props.currency ?? "$");

  const calc = useMemo(() => {
    const safeBill = bill ?? 0;
    const safeTip = tipPercent ?? 0;
    const safePeople = Math.max(1, people ?? 1);
    if (safeBill <= 0) return null;
    return compute(safeBill, safeTip, safePeople, roundUp);
  }, [bill, tipPercent, people, roundUp]);

  function onDone() {
    if (!calc) closeWidget("Nothing to calculate.");
    else closeWidget(`Total ${format(calc.total, currency)}, ${format(calc.roundedPerPerson, currency)} each.`);
  }

  return (
    <Form
      header={<CardHeader title="Tip Calculator" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          {calc && (
            <Action.CopyToClipboard
              title="Copy total"
              content={format(roundUp ? calc.roundedTotal : calc.total, currency)}
            />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.NumberField name="bill" label="Bill" value={bill} onChange={setBill} min={0} />
      <Form.NumberField name="tipPercent" label="Tip %" value={tipPercent} onChange={setTipPercent} min={0} max={100} />
      <Form.NumberField name="people" label="People" value={people} onChange={setPeople} min={1} max={100} />
      <Form.TextField name="currency" label="Currency" value={currency} onChange={setCurrency} />
      <Form.Checkbox name="roundUp" label="Round per-person up" checked={roundUp} onChange={setRoundUp} variant="switch" />
      {calc && (
        <Paper
          markdown={[
            `### ${format(calc.roundedPerPerson, currency)} per person`,
            "",
            "| | |",
            "|---|---|",
            `| **Bill** | \`${format(calc.bill, currency)}\` |`,
            `| **Tip** (${tipPercent ?? 0}%) | \`${format(calc.tip, currency)}\` |`,
            `| **Total** | \`${format(calc.total, currency)}\` |`,
            people && people > 1 ? `| **Per person** | \`${format(calc.perPerson, currency)}\` |` : "",
            roundUp && people && people > 1
              ? `| **Per person (rounded ↑)** | \`${format(calc.roundedPerPerson, currency)}\` |`
              : "",
            roundUp ? `| **Total paid (rounded ↑)** | \`${format(calc.roundedTotal, currency)}\` |` : "",
          ]
            .filter(Boolean)
            .join("\n")}
        />
      )}
    </Form>
  );
}

const CalculateTipWidget = defineWidget({
  name: "calculate-tip",
  description:
    "Calculate tip on a bill and (optionally) split across multiple people. Configurable currency symbol; toggleable round-up so each person's share lands on a whole unit (and the table shows what the table actually pays in total when rounded).",
  schema,
  component: CalculateTip,
});

export default CalculateTipWidget;
