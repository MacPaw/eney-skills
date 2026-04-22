# Net Worth MCP — Skill Feedback

## 1. What problem are you solving?

Tracking personal net worth across multiple asset classes and accounts is fragmented. You either manage it manually in spreadsheets, pay for premium apps, or miss the full picture because crypto, stocks, and cash all live in different places. There's no single lightweight tool that shows your real P&L — including inflation-adjusted cash — across all accounts in one view.

## 2. How are you solving it?

Built a local-first MCP skill that aggregates portfolio positions stored in a JSON file (`~/.eney/net-worth.json`) and fetches live prices at open time:

- **Crypto** — CoinGecko free API (ticker → ID resolution → USD price)
- **Stocks / ETFs** — Yahoo Finance unofficial chart API
- **Cash** — World Bank CPI data to calculate real (inflation-adjusted) value since the date the cash was deposited

The portfolio view groups positions by symbol, shows per-account P&L with 🟢/🔴 indicators, and displays total invested vs current value. Add Position is embedded as an inline view (no separate widget), with a "Fetch Current Price" action to auto-fill the buy price field.

## 3. What do you expect from it?

- Quick daily check-in: open Eney, see current P&L across all accounts in seconds
- Honest cash tracking: instead of pretending $10K in savings is still $10K, show what it's worth in today's purchasing power
- Low friction additions: type a ticker, fetch price, enter amount — done in under 30 seconds
- Fully private: no cloud sync, no accounts, no subscriptions — data stays local

## 4. Any extra use cases?

- **DCA tracking** — add the same asset multiple times at different prices to track dollar-cost averaging performance
- **Multi-currency portfolios** — UAH, EUR, USD cash positions with country-specific CPI rates
- **Portfolio rebalancing insight** — see which assets are outperforming to decide where to add next
- **Pre-tax planning** — know your realized vs unrealized P&L before end of year
- **Family finance view** — track spouse's accounts separately by account name, total together

## 5. Your vibe coder experience — what's missing?

### What worked well
- The Eney widget model (Form + Paper + ActionPanel) is fast to compose — the full skill was built in under an hour
- Integrating third-party APIs (CoinGecko, Yahoo Finance, World Bank) was straightforward — no API keys required, just fetch and use

### Struggles & missing pieces

**Cross-widget navigation doesn't work.**
`closeWidget("open:add-position")` closes the current widget and returns a string — it doesn't open the target widget. There's no API to navigate to another widget programmatically. Had to embed the Add Position form as an inline view state inside the portfolio widget. This is a significant limitation for multi-step flows.

**App gets stuck / hangs on tool open.**
When opening the widget via deeplink (`eney://run?...`), Eney sometimes enters an infinite loading state. Requires force-quitting and relaunching. Happened 4–5 times during development. Hard to distinguish between a code error and an Eney runtime issue — the spinner gives no feedback.

**No error surface from the MCP side.**
When the widget crashes or throws during render, Eney shows a spinner — not an error message. There's no way to surface runtime errors from the server process to the user in the widget UI. `console.error` goes nowhere visible.

**No persistent widget state.**
Every time the widget opens it re-fetches everything from scratch. There's no cache layer or way to persist UI state between sessions, so with slow APIs the loading experience is noticeable.

## 6. Possible Improvements

**Import / Export**
- Import positions from CSV or JSON (e.g. export from Binance, Coinbase, IBKR)
- Export portfolio snapshot to CSV for further analysis in spreadsheets

**Charts & Visualization**
- Portfolio allocation pie chart (% by asset or by account)
- P&L over time line chart if price history is stored locally
- Inflation vs nominal value bar chart for cash positions

**Price Alerts**
- Set a target price or P&L threshold per position
- Notify when an asset crosses the threshold (via Eney notification or system alert)

**Multi-currency Support**
- Show totals in any base currency (EUR, UAH, etc.) using live FX rates
- Per-position currency override instead of always converting to USD

**Historical Snapshots**
- Save a daily/weekly portfolio snapshot locally
- Show net worth growth over time

**Smarter Cash Tracking**
- Support fixed-term deposits with interest rate and maturity date
- Show nominal + interest earned vs inflation loss side by side

**Edit Positions**
- Edit amount, buy price, or account name after adding
- Currently you can only remove and re-add
Every time the widget opens it re-fetches everything from scratch. There's no cache layer or way to persist UI state between sessions, so with slow APIs the loading experience is noticeable.
