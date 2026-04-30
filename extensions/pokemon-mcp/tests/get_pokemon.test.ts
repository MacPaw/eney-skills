import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import PokemonWidget from "../components/get_pokemon.js";

describe("Pokemon widget", () => {
  it("renders a form when given a query", async () => {
    const session = await createUIXTestSession(PokemonWidget, { query: "pikachu" });
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Look Up, Random, and Done actions", async () => {
    const session = await createUIXTestSession(PokemonWidget, { query: "1" });

    assert.ok(session.findWidget({ title: "Look Up" }), "should have Look Up button");
    assert.ok(session.findWidget({ title: "Random" }), "should have Random button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
