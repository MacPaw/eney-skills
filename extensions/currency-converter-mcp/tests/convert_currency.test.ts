import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CurrencyConverterWidget from "../components/convert_currency.js";

describe("Currency converter widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(CurrencyConverterWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Convert, Swap, and Done actions", async () => {
    const session = await createUIXTestSession(CurrencyConverterWidget);

    assert.ok(session.findWidget({ title: "Convert" }), "should have a Convert button");
    assert.ok(session.findWidget({ title: "Swap" }), "should have a Swap button");
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });
});
