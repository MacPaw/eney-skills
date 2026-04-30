import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  count: z
    .number()
    .int()
    .optional()
    .describe("Number of coins to flip in one go. Defaults to 1. Max 10,000."),
});

type Props = z.infer<typeof schema>;

interface FlipResult {
  count: number;
  flips: ("H" | "T")[];
  heads: number;
  tails: number;
}

function flip(count: number): FlipResult {
  const safe = Math.max(1, Math.min(10_000, Math.floor(count)));
  const flips: ("H" | "T")[] = [];
  let heads = 0;
  let tails = 0;
  for (let i = 0; i < safe; i++) {
    if (Math.random() < 0.5) {
      flips.push("H");
      heads++;
    } else {
      flips.push("T");
      tails++;
    }
  }
  return { count: safe, flips, heads, tails };
}

function buildMarkdown(r: FlipResult): string {
  if (r.count === 1) {
    const v = r.flips[0];
    return [
      `### ${v === "H" ? "🪙 Heads" : "🪙 Tails"}`,
      ``,
      `_${v === "H" ? "H" : "T"}_`,
    ].join("\n");
  }
  const headsPct = ((r.heads / r.count) * 100).toFixed(1);
  const tailsPct = ((r.tails / r.count) * 100).toFixed(1);
  // Show first 100 flips inline if requested count is large
  const sample = r.flips.slice(0, 100).join(" ");
  const truncated = r.flips.length > 100 ? " …" : "";
  return [
    `### ${r.count.toLocaleString()} flips`,
    ``,
    `| | | |`,
    `|---|---|---|`,
    `| 🪙 Heads | **${r.heads.toLocaleString()}** | ${headsPct}% |`,
    `| 🪙 Tails | **${r.tails.toLocaleString()}** | ${tailsPct}% |`,
    ``,
    `**Sequence (first ${Math.min(100, r.flips.length)}):**`,
    "",
    "```",
    sample + truncated,
    "```",
  ].join("\n");
}

function FlipCoin(props: Props) {
  const closeWidget = useCloseWidget();
  const [count, setCount] = useState<number>(props.count ?? 1);
  const [result, setResult] = useState<FlipResult>(() => flip(props.count ?? 1));

  function onFlip() {
    setResult(flip(count));
  }

  function onFlip100() {
    setCount(100);
    setResult(flip(100));
  }

  function onDone() {
    if (result.count === 1) {
      closeWidget(result.flips[0] === "H" ? "Heads" : "Tails");
    } else {
      closeWidget(
        `${result.count} flips: ${result.heads} heads, ${result.tails} tails ` +
        `(${((result.heads / result.count) * 100).toFixed(1)}% heads).`,
      );
    }
  }

  return (
    <Form
      header={<CardHeader title="Coin Flip" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Flip" onSubmit={onFlip} style="primary" />
          <Action title="Flip again" onAction={onFlip} style="secondary" />
          <Action title="Flip 100" onAction={onFlip100} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(result)} />
      <Form.NumberField
        name="count"
        label="Number of coins"
        value={count}
        onChange={(v) => setCount(Math.max(1, Math.min(10_000, Math.floor(Number(v) || 1))))}
      />
    </Form>
  );
}

const FlipCoinWidget = defineWidget({
  name: "flip_coin",
  description:
    "Flip one or many fair coins and see the result. Multi-flip mode shows the heads/tails counts and percentages plus a sequence preview (first 100 flips). Pure local Math.random; max 10,000 flips per call.",
  schema,
  component: FlipCoin,
});

export default FlipCoinWidget;
