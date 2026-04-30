import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  amount: z.number().optional().describe("Amount to convert. Defaults to 100."),
  from: z.string().optional().describe("Source ISO 4217 currency code, e.g. 'USD', 'EUR'. Defaults to USD."),
  to: z.string().optional().describe("Target ISO 4217 currency code, e.g. 'EUR', 'JPY'. Defaults to EUR."),
});

type Props = z.infer<typeof schema>;

interface ConversionResult {
  amount: number;
  from: string;
  to: string;
  rate: number;
  converted: number;
  date: string;
}

async function fetchConversion(amount: number, from: string, to: string): Promise<ConversionResult> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  if (fromUpper === toUpper) {
    return {
      amount,
      from: fromUpper,
      to: toUpper,
      rate: 1,
      converted: amount,
      date: new Date().toISOString().slice(0, 10),
    };
  }
  // Frankfurter is a free, no-key currency conversion API powered by the European Central Bank.
  const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${encodeURIComponent(fromUpper)}&to=${encodeURIComponent(toUpper)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Frankfurter API error ${res.status}. Verify both currency codes are supported.`);
  }
  const data = await res.json() as {
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
  };
  const converted = data.rates[toUpper];
  if (typeof converted !== "number") {
    throw new Error(`No rate returned for ${toUpper}.`);
  }
  return {
    amount: data.amount,
    from: data.base,
    to: toUpper,
    rate: converted / data.amount,
    converted,
    date: data.date,
  };
}

function formatNumber(n: number, fractionDigits = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function CurrencyConverter(props: Props) {
  const closeWidget = useCloseWidget();
  const [amount, setAmount] = useState<number>(props.amount ?? 100);
  const [from, setFrom] = useState<string>((props.from ?? "USD").toUpperCase());
  const [to, setTo] = useState<string>((props.to ?? "EUR").toUpperCase());
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fetchToken, setFetchToken] = useState(0);

  useEffect(() => {
    if (amount <= 0 || !from || !to) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetchConversion(amount, from, to)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchToken]);

  function onConvert() {
    setFetchToken((t) => t + 1);
  }

  function onSwap() {
    setFrom(to);
    setTo(from);
    setFetchToken((t) => t + 1);
  }

  function onDone() {
    if (result) {
      closeWidget(
        `${formatNumber(result.amount)} ${result.from} = ${formatNumber(result.converted)} ${result.to} ` +
        `(rate ${result.rate.toFixed(4)}, as of ${result.date}).`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed without converting.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Fetching rate…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : status === "done" && result
          ? [
              `### ${formatNumber(result.amount)} ${result.from} = **${formatNumber(result.converted)} ${result.to}**`,
              ``,
              `Rate: \`1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}\``,
              ``,
              `_Source: Frankfurter (ECB) · Updated ${result.date}_`,
            ].join("\n")
          : "_Enter values and tap Convert._";

  return (
    <Form
      header={<CardHeader title="Currency Converter" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Convert" onSubmit={onConvert} style="primary" />
          <Action title="Swap" onAction={onSwap} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.NumberField
        name="amount"
        label="Amount"
        value={amount}
        onChange={(v) => setAmount(Number(v) || 0)}
      />
      <Form.TextField
        name="from"
        label="From (ISO code)"
        value={from}
        onChange={(v) => setFrom(v.toUpperCase())}
      />
      <Form.TextField
        name="to"
        label="To (ISO code)"
        value={to}
        onChange={(v) => setTo(v.toUpperCase())}
      />
    </Form>
  );
}

const CurrencyConverterWidget = defineWidget({
  name: "convert_currency",
  description:
    "Convert between currencies using ECB rates via the free Frankfurter API. Accepts ISO 4217 codes (USD, EUR, JPY, GBP, etc.).",
  schema,
  component: CurrencyConverter,
});

export default CurrencyConverterWidget;
