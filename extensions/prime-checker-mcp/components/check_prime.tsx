import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  isPrime,
  factorize,
  nextPrime,
  previousPrime,
  primesUpTo,
  type FactorEntry,
} from "../helpers/primes.js";

const schema = z.object({
  number: z
    .number()
    .int()
    .optional()
    .describe("Integer to check. Defaults to 31."),
});

type Props = z.infer<typeof schema>;

interface Analysis {
  n: number;
  prime: boolean;
  factors: FactorEntry[];
  next: number;
  previous: number | null;
}

function analyze(n: number): Analysis {
  const safe = Math.max(0, Math.floor(n));
  const prime = isPrime(safe);
  return {
    n: safe,
    prime,
    factors: prime || safe < 2 ? [] : factorize(safe),
    next: nextPrime(safe),
    previous: previousPrime(safe),
  };
}

function formatFactors(f: FactorEntry[]): string {
  if (f.length === 0) return "—";
  return f
    .map((e) => (e.exponent === 1 ? `${e.prime}` : `${e.prime}^${e.exponent}`))
    .join(" × ");
}

function buildMarkdown(a: Analysis, listing: number[] | null): string {
  const lines: string[] = [];
  if (a.n < 2) {
    lines.push(`### ${a.n} is **not prime** (primes are ≥ 2)`);
  } else if (a.prime) {
    lines.push(`### ✅ **${a.n}** is **prime**`);
  } else {
    lines.push(`### ❌ **${a.n}** is composite`);
    lines.push("");
    lines.push(`Prime factorisation: \`${formatFactors(a.factors)}\``);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Previous prime | ${a.previous === null ? "—" : a.previous} |`);
  lines.push(`| Next prime | ${a.next} |`);
  if (listing) {
    lines.push("");
    lines.push(`**Primes up to ${listing[listing.length - 1] ?? 0}** (${listing.length} found):`);
    lines.push("");
    lines.push("```");
    lines.push(listing.join(", "));
    lines.push("```");
  }
  return lines.join("\n");
}

function PrimeChecker(props: Props) {
  const closeWidget = useCloseWidget();
  const [number, setNumber] = useState<number>(props.number ?? 31);
  const [analysis, setAnalysis] = useState<Analysis>(() => analyze(props.number ?? 31));
  const [listing, setListing] = useState<number[] | null>(null);

  function onCheck() {
    setAnalysis(analyze(number));
    setListing(null);
  }

  function onListPrimes() {
    setAnalysis(analyze(number));
    setListing(primesUpTo(Math.min(Math.max(number, 2), 5_000_000), 1000));
  }

  function onNext() {
    const next = nextPrime(number);
    setNumber(next);
    setAnalysis(analyze(next));
    setListing(null);
  }

  function onDone() {
    if (analysis.n < 2) {
      closeWidget(`${analysis.n} is not prime (primes are ≥ 2).`);
      return;
    }
    if (analysis.prime) {
      closeWidget(`${analysis.n} is prime. Next prime: ${analysis.next}. Previous prime: ${analysis.previous ?? "—"}.`);
    } else {
      closeWidget(
        `${analysis.n} is composite. Prime factorisation: ${formatFactors(analysis.factors)}. ` +
        `Next prime: ${analysis.next}. Previous prime: ${analysis.previous ?? "—"}.`,
      );
    }
  }

  return (
    <Form
      header={<CardHeader title="Prime Checker" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Check" onSubmit={onCheck} style="primary" />
          <Action title="Next prime" onAction={onNext} style="secondary" />
          <Action title="List primes ≤ N" onAction={onListPrimes} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(analysis, listing)} />
      <Form.NumberField
        name="number"
        label="Integer (≥ 0)"
        value={number}
        onChange={(v) => setNumber(Math.max(0, Math.floor(Number(v) || 0)))}
      />
    </Form>
  );
}

const PrimeCheckerWidget = defineWidget({
  name: "check_prime",
  description:
    "Check whether an integer is prime, list its prime factors with exponents, and find the next/previous prime. Uses deterministic Miller-Rabin for large values; fully local computation.",
  schema,
  component: PrimeChecker,
});

export default PrimeCheckerWidget;
