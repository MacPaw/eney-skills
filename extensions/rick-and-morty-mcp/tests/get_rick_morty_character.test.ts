import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import RickMortyWidget from "../components/get_rick_morty_character.js";

describe("Rick & Morty widget", () => {
  it("renders a form when given a query", async () => {
    const session = await createUIXTestSession(RickMortyWidget, { query: "1" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up, Random, and Done", async () => {
    const session = await createUIXTestSession(RickMortyWidget, { query: "Rick" });
    assert.ok(session.findWidget({ title: "Look Up" }), "Look Up button");
    assert.ok(session.findWidget({ title: "Random" }), "Random button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
