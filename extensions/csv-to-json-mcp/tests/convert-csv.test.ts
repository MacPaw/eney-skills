import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ConvertCsvWidget from "../components/convert-csv.js";

import { parseCsv } from "../helpers/csv.js";

describe("ConvertCsv widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(ConvertCsvWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(ConvertCsvWidget, {
      csv: "a,b,c\n1,2,3",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ConvertCsvWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("parseCsv helper", () => {
  it("parses simple rows with header", () => {
    const result = parseCsv("a,b\n1,2\n3,4", { delimiter: ",", hasHeader: true });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.rows, [
        { a: "1", b: "2" },
        { a: "3", b: "4" },
      ]);
    }
  });

  it("handles quoted fields with embedded delimiter", () => {
    const result = parseCsv('name,note\n"Doe, J.","hello, world"', { delimiter: ",", hasHeader: true });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.rows, [{ name: "Doe, J.", note: "hello, world" }]);
    }
  });

  it("handles escaped quotes", () => {
    const result = parseCsv('q\n"she said ""hi"""', { delimiter: ",", hasHeader: true });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.rows, [{ q: 'she said "hi"' }]);
    }
  });

  it("handles CRLF line endings", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4", { delimiter: ",", hasHeader: true });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal((result.rows as Record<string, string>[]).length, 2);
  });

  it("supports tab delimiter", () => {
    const result = parseCsv("a\tb\n1\t2", { delimiter: "\t", hasHeader: true });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.rows, [{ a: "1", b: "2" }]);
  });

  it("returns error on empty input", () => {
    const result = parseCsv("   ", { delimiter: ",", hasHeader: true });
    assert.equal(result.ok, false);
  });
});
