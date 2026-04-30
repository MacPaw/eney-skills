import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import JsonToCsvWidget from "../components/convert_json_to_csv.js";
import { convert } from "../helpers/json-to-csv.js";

describe("JSON to CSV widget", () => {
  it("renders a form with provided JSON", async () => {
    const session = await createUIXTestSession(JsonToCsvWidget, {
      json: '[{"a":1,"b":2}]',
    });
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Convert and Done actions", async () => {
    const session = await createUIXTestSession(JsonToCsvWidget, {
      json: '[{"a":1}]',
    });

    assert.ok(session.findWidget({ title: "Convert" }), "should have Convert button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});

describe("convert helper", () => {
  it("converts a simple array of objects", () => {
    const r = convert(JSON.stringify([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]), { delimiter: ",", flatten: true, forceQuoteAll: false });

    assert.equal(r.rowCount, 2);
    assert.equal(r.columnCount, 2);
    assert.deepEqual(r.headers, ["name", "age"]);
    assert.equal(r.csv, "name,age\nAlice,30\nBob,25");
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const r = convert(JSON.stringify([
      { a: 'has, comma', b: 'has "quote"', c: "two\nlines" },
    ]), { delimiter: ",", flatten: true, forceQuoteAll: false });

    assert.equal(r.csv, 'a,b,c\n"has, comma","has ""quote""","two\nlines"');
  });

  it("flattens nested objects with dot paths when flatten=true", () => {
    const r = convert(JSON.stringify([
      { user: { name: "Alice", id: 1 }, active: true },
    ]), { delimiter: ",", flatten: true, forceQuoteAll: false });

    assert.deepEqual(r.headers, ["user.name", "user.id", "active"]);
    assert.equal(r.csv, "user.name,user.id,active\nAlice,1,true");
  });

  it("JSON-stringifies nested objects when flatten=false", () => {
    const r = convert(JSON.stringify([
      { user: { name: "Alice" } },
    ]), { delimiter: ",", flatten: false, forceQuoteAll: false });

    assert.equal(r.csv, 'user\n"{""name"":""Alice""}"');
  });

  it("unions keys across rows", () => {
    const r = convert(JSON.stringify([
      { a: 1 },
      { b: 2 },
      { a: 3, c: 4 },
    ]), { delimiter: ",", flatten: true, forceQuoteAll: false });

    assert.deepEqual(r.headers, ["a", "b", "c"]);
    assert.equal(r.csv, "a,b,c\n1,,\n,2,\n3,,4");
  });

  it("supports a single object as input", () => {
    const r = convert(JSON.stringify({ a: 1, b: 2 }), {
      delimiter: ",",
      flatten: true,
      forceQuoteAll: false,
    });

    assert.equal(r.rowCount, 1);
    assert.equal(r.csv, "a,b\n1,2");
  });

  it("rejects invalid JSON", () => {
    assert.throws(() =>
      convert("not json", { delimiter: ",", flatten: true, forceQuoteAll: false }),
    );
  });

  it("supports tab delimiter", () => {
    const r = convert(JSON.stringify([{ a: 1, b: 2 }]), {
      delimiter: "\t",
      flatten: true,
      forceQuoteAll: false,
    });

    assert.equal(r.csv, "a\tb\n1\t2");
  });

  it("forceQuoteAll wraps every cell", () => {
    const r = convert(JSON.stringify([{ a: 1, b: "x" }]), {
      delimiter: ",",
      flatten: true,
      forceQuoteAll: true,
    });

    assert.equal(r.csv, '"a","b"\n"1","x"');
  });
});
