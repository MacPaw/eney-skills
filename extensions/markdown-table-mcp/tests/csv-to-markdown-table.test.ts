import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CsvToMarkdownTableWidget from "../components/csv-to-markdown-table.js";

import { parseRows, rowsToMarkdownTable } from "../helpers/parse.js";

describe("CsvToMarkdownTable widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(CsvToMarkdownTableWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(CsvToMarkdownTableWidget, {
      csv: "a,b\n1,2",
      alignment: "center",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(CsvToMarkdownTableWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("rowsToMarkdownTable helper", () => {
  it("renders a basic table with header", () => {
    const rows = parseRows("a,b\n1,2", ",");
    const out = rowsToMarkdownTable(rows, true, "none");
    assert.equal(out, "| a | b |\n| --- | --- |\n| 1 | 2 |");
  });

  it("uses synthetic headers when header is off", () => {
    const rows = parseRows("1,2\n3,4", ",");
    const out = rowsToMarkdownTable(rows, false, "none");
    assert.match(out, /^\| Column 1 \| Column 2 \|/);
  });

  it("escapes pipes in cell content", () => {
    const rows = parseRows('a,b\n"x|y","z"', ",");
    const out = rowsToMarkdownTable(rows, true, "none");
    assert.match(out, /x\\\|y/);
  });

  it("renders alignment markers", () => {
    const rows = parseRows("a,b\n1,2", ",");
    assert.match(rowsToMarkdownTable(rows, true, "left"), /:---/);
    assert.match(rowsToMarkdownTable(rows, true, "center"), /:---:/);
    assert.match(rowsToMarkdownTable(rows, true, "right"), /---:/);
  });
});
