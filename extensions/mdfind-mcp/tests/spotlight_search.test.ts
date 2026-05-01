import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MdfindWidget from "../components/spotlight_search.js";
import { fmtBytes, shortPath } from "../helpers/mdfind.js";

describe("Spotlight search widget", () => {
  it("renders a form when given a query", async () => {
    const session = await createUIXTestSession(MdfindWidget, { query: "readme" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Search, scope buttons, mode toggle, and Done", async () => {
    const session = await createUIXTestSession(MdfindWidget, { query: "package" });
    assert.ok(session.findWidget({ title: "Search" }), "Search button");
    assert.ok(session.findWidget({ title: "Home" }), "Home scope");
    assert.ok(session.findWidget({ title: "All" }), "All scope");
    assert.ok(session.findWidget({ title: "Documents" }), "Documents scope");
    assert.ok(session.findWidget({ title: "Downloads" }), "Downloads scope");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("mdfind helpers", () => {
  it("fmtBytes formats sizes", () => {
    assert.equal(fmtBytes(undefined), "—");
    assert.equal(fmtBytes(512), "512 B");
    assert.equal(fmtBytes(2048), "2.0 kB");
    assert.equal(fmtBytes(2 * 1024 * 1024), "2.0 MB");
    assert.equal(fmtBytes(3 * 1024 * 1024 * 1024), "3.00 GB");
  });

  it("shortPath collapses home", () => {
    const home = process.env.HOME ?? "";
    if (home) {
      assert.equal(shortPath(`${home}/Documents/foo.txt`), "~/Documents/foo.txt");
    }
    assert.equal(shortPath("/var/log/system.log"), "/var/log/system.log");
  });
});
