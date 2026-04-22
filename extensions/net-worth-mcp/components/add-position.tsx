import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { addPosition, AssetType } from "../helpers/storage.js";
import { fetchCurrentPrice } from "../helpers/prices.js";

const schema = z.object({});

const ASSET_TYPES: { label: string; value: AssetType }[] = [
  { label: "Crypto", value: "crypto" },
  { label: "Stock / ETF", value: "stock" },
  { label: "Cash", value: "cash" },
];

function AddPosition() {
  const closeWidget = useCloseWidget();

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
          <ActionPanel layout="row">
            <Action.SubmitForm title="Add Another" onSubmit={() => {
              setSuccess(""); setSymbol(""); setAccount(""); setAmount(null); setBuyPrice(null);
            }} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(success)} style="primary" />
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

const AddPositionWidget = defineWidget({
  name: "add-position",
  description: "Add a new asset position to your net worth portfolio",
  schema,
  component: AddPosition,
});

export default AddPositionWidget;
