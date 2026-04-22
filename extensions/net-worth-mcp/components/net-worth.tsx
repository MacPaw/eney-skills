import { useState, useEffect } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { loadPortfolio, removePosition, addPosition, Position, AssetType } from "../helpers/storage.js";
import { fetchCurrentPrice, getInflationLoss } from "../helpers/prices.js";

const schema = z.object({});

interface PositionResult {
  position: Position;
  currentPrice: number;
  realValue: number;
  invested: number;
  pnl: number;
  pnlPct: number;
}

const ASSET_TYPES: { label: string; value: AssetType }[] = [
  { label: "Crypto", value: "crypto" },
  { label: "Stock / ETF", value: "stock" },
  { label: "Cash", value: "cash" },
];

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pnlStr(pnl: number, pct: number): string {
  const sign = pnl >= 0 ? "+" : "-";
  return `${sign}$${fmt(Math.abs(pnl))} (${sign}${Math.abs(pct).toFixed(1)}%)`;
}

async function computeResults(positions: Position[]): Promise<PositionResult[]> {
  return Promise.all(
    positions.map(async (pos) => {
      const currentPrice = await fetchCurrentPrice(pos.type, pos.symbol);
      const invested = pos.amount * pos.buyPrice;
      let realValue: number;

      if (pos.type === "cash") {
        const multiplier = await getInflationLoss(pos.symbol, pos.addedAt);
        realValue = invested / multiplier;
      } else {
        realValue = pos.amount * currentPrice;
      }

      const pnl = realValue - invested;
      const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
      return { position: pos, currentPrice, realValue, invested, pnl, pnlPct };
    })
  );
}

function buildPortfolioMd(results: PositionResult[]): string {
  if (results.length === 0) return "No positions yet. Use **Add Position** to get started.";

  const groups = new Map<string, PositionResult[]>();
  for (const r of results) {
    const key = r.position.symbol;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const lines: string[] = [];
  let totalInvested = 0;
  let totalValue = 0;

  for (const [symbol, group] of groups) {
    const first = group[0];
    const header = first.position.type === "cash"
      ? `**${symbol}** *(inflation-adjusted)*`
      : `**${symbol}** — $${fmt(first.currentPrice)}`;
    lines.push(header);

    for (const r of group) {
      const dot = r.pnl >= 0 ? "🟢" : "🔴";
      const valueStr = r.position.type === "cash"
        ? `real $${fmt(r.realValue)}`
        : `$${fmt(r.realValue)}`;
      lines.push(
        `${dot} ${r.position.account} · ${r.position.amount} @ $${fmt(r.position.buyPrice)} → ${valueStr} · ${pnlStr(r.pnl, r.pnlPct)}`
      );
      totalInvested += r.invested;
      totalValue += r.realValue;
    }

    if (group.length > 1) {
      const sub = group.reduce((s, r) => s + r.pnl, 0);
      const subInv = group.reduce((s, r) => s + r.invested, 0);
      lines.push(`  *Subtotal: ${pnlStr(sub, subInv > 0 ? (sub / subInv) * 100 : 0)}*`);
    }
    lines.push("");
  }

  const totalPnl = totalValue - totalInvested;
  const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  lines.push("---");
  lines.push(`**Total invested:** $${fmt(totalInvested)}`);
  lines.push(`**Current value:** $${fmt(totalValue)}`);
  lines.push(`**Total P&L:** ${pnlStr(totalPnl, totalPct)}`);

  return lines.join("\n");
}

// ─── Add Position View ────────────────────────────────────────────────────────

interface AddPositionViewProps {
  onDone: () => void;
  onBack: () => void;
}

function AddPositionView({ onDone, onBack }: AddPositionViewProps) {
  const [type, setType] = useState<AssetType>("crypto");
  const [symbol, setSymbol] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [buyPrice, setBuyPrice] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const symbolLabel = type === "cash" ? "Currency (USD, EUR, UAH…)" : "Ticker (ETH, AAPL…)";
  const priceLabel = type === "cash" ? "Rate / value per unit" : "Buy price (USD)";

  async function onFetchPrice() {
    if (!symbol.trim()) return;
    setIsFetching(true);
    setError("");
    try {
      const price = await fetchCurrentPrice(type, symbol.trim().toUpperCase());
      setBuyPrice(price);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsFetching(false);
    }
  }

  async function onSubmit() {
    if (!symbol.trim() || !account.trim() || amount === null || buyPrice === null) return;
    setIsSubmitting(true);
    setError("");
    try {
      await addPosition({
        type,
        symbol: symbol.trim().toUpperCase(),
        account: account.trim(),
        amount,
        buyPrice,
        currency: "USD",
      });
      setSuccess(`✓ Added ${amount} ${symbol.toUpperCase()} on ${account}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <Form
        actions={
          <ActionPanel layout="column">
            <Action.SubmitForm title="Add Another" onSubmit={() => {
              setSuccess(""); setSymbol(""); setAccount(""); setAmount(null); setBuyPrice(null);
            }} style="secondary" />
            <Action title="Back to Portfolio" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={success} />
      </Form>
    );
  }

  const canSubmit = !!symbol.trim() && !!account.trim() && amount !== null && buyPrice !== null && !isSubmitting;

  return (
    <Form
      actions={
        <ActionPanel layout="column">
          <Action
            title={isFetching ? "Fetching…" : "Fetch Current Price"}
            onAction={onFetchPrice}
            style="secondary"
            isLoading={isFetching}
            isDisabled={!symbol.trim() || isFetching || type === "cash"}
          />
          <Action.SubmitForm
            title={isSubmitting ? "Saving…" : "Add Position"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSubmitting}
            isDisabled={!canSubmit}
          />
          <Action title="← Back" onAction={onBack} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="type" label="Asset Type" value={type} onChange={(v) => { setType(v as AssetType); setSymbol(""); setBuyPrice(null); }}>
        {ASSET_TYPES.map((t) => (
          <Form.Dropdown.Item key={t.value} value={t.value} title={t.label} />
        ))}
      </Form.Dropdown>
      <Form.TextField name="symbol" label={symbolLabel} value={symbol} onChange={setSymbol} />
      <Form.TextField name="account" label="Account / Wallet" value={account} onChange={setAccount} />
      <Form.NumberField name="amount" label="Amount" value={amount} min={0} onChange={setAmount} />
      <Form.NumberField name="buyPrice" label={priceLabel} value={buyPrice} min={0} onChange={setBuyPrice} />
    </Form>
  );
}

// ─── Portfolio View ───────────────────────────────────────────────────────────

function NetWorth() {
  const closeWidget = useCloseWidget();

  const [view, setView] = useState<"portfolio" | "add">("portfolio");
  const [md, setMd] = useState("Loading portfolio…");
  const [results, setResults] = useState<PositionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removeId, setRemoveId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const portfolio = await loadPortfolio();
      if (portfolio.positions.length === 0) {
        setMd("No positions yet. Use **Add Position** to get started.");
        setResults([]);
        return;
      }
      const computed = await computeResults(portfolio.positions);
      setResults(computed);
      setMd(buildPortfolioMd(computed));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onRemoveChange(id: string) {
    setRemoveId(id);
    if (!id) return;
    await removePosition(id);
    setRemoveId("");
    await load();
  }

  if (view === "add") {
    return (
      <AddPositionView
        onDone={() => { setView("portfolio"); load(); }}
        onBack={() => setView("portfolio")}
      />
    );
  }

  return (
    <Form
      actions={
        <ActionPanel layout="column">
          <Action
            title={isLoading ? "Refreshing…" : "Refresh"}
            onAction={load}
            style="secondary"
            isLoading={isLoading}
            isDisabled={isLoading}
          />
          <Action title="Add Position" onAction={() => setView("add")} style="secondary" />
          {results.length > 0 && (
            <Form.Dropdown name="remove" label="" value={removeId} onChange={onRemoveChange}>
              <Form.Dropdown.Item value="" title="Remove position…" />
              {results.map((r) => (
                <Form.Dropdown.Item
                  key={r.position.id}
                  value={r.position.id}
                  title={`${r.position.symbol} — ${r.position.account}`}
                />
              ))}
            </Form.Dropdown>
          )}
          <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={md} isScrollable />
    </Form>
  );
}

const NetWorthWidget = defineWidget({
  name: "net-worth",
  description: "Show your portfolio P&L across crypto, stocks and cash positions",
  schema,
  component: NetWorth,
});

export default NetWorthWidget;
