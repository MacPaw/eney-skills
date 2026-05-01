import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import KillProcessWidget from "../components/kill_process.js";
import { fmtBytes } from "../helpers/processes.js";

describe("Kill process widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(KillProcessWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh, sort buttons, kill signals, and Done", async () => {
    const session = await createUIXTestSession(KillProcessWidget);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Sort by CPU" }), "Sort by CPU");
    assert.ok(session.findWidget({ title: "Sort by RAM" }), "Sort by RAM");
    assert.ok(session.findWidget({ title: "Send SIGTERM" }), "SIGTERM button");
    assert.ok(session.findWidget({ title: "Send SIGKILL" }), "SIGKILL button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("processes helpers", () => {
  it("fmtBytes formats KB/MB/GB", () => {
    assert.equal(fmtBytes(512), "512 KB");
    assert.equal(fmtBytes(2048), "2.0 MB");
    assert.equal(fmtBytes(2 * 1024 * 1024), "2.00 GB");
  });
});
