import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CronNextRunsWidget from "../components/cron_next_runs.js";
import { nextRuns, formatRun } from "../helpers/cron.js";

describe("Cron next runs widget", () => {
  it("renders a form when given an expression", async () => {
    const session = await createUIXTestSession(CronNextRunsWidget, { expression: "0 9 * * *" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Compute, presets, timezone buttons, and Done", async () => {
    const session = await createUIXTestSession(CronNextRunsWidget, { expression: "0 * * * *" });
    assert.ok(session.findWidget({ title: "Compute" }), "Compute button");
    assert.ok(session.findWidget({ title: "Hourly" }), "Hourly preset");
    assert.ok(session.findWidget({ title: "Weekdays 9am" }), "Weekdays 9am preset");
    assert.ok(session.findWidget({ title: "UTC" }), "UTC timezone");
    assert.ok(session.findWidget({ title: "Tokyo" }), "Tokyo timezone");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("cron helpers", () => {
  it("computes the requested number of runs", () => {
    const r = nextRuns("0 * * * *", 5);
    assert.equal(r.runs.length, 5);
    assert.equal(r.timezone, "UTC");
  });

  it("clamps count to [1, 50]", () => {
    const high = nextRuns("0 * * * *", 999);
    assert.equal(high.runs.length, 50);
    const low = nextRuns("0 * * * *", 0);
    assert.equal(low.runs.length, 1);
  });

  it("rejects an invalid expression", () => {
    assert.throws(() => nextRuns("not a cron", 3));
  });

  it("rejects an empty expression", () => {
    assert.throws(() => nextRuns("   ", 3));
  });

  it("hourly cron produces strictly increasing one-hour gaps", () => {
    const r = nextRuns("0 * * * *", 4);
    for (let i = 1; i < r.runs.length; i++) {
      const prev = new Date(r.runs[i - 1].iso).getTime();
      const cur = new Date(r.runs[i].iso).getTime();
      assert.equal(cur - prev, 60 * 60 * 1000, `gap between run ${i - 1} and ${i}`);
    }
  });

  it("formatRun in UTC produces a recognisable string", () => {
    const d = new Date("2026-05-01T09:00:00Z");
    const out = formatRun(d);
    assert.ok(/UTC$/.test(out.display));
    assert.equal(out.iso, "2026-05-01T09:00:00.000Z");
  });

  it("formatRun with timezone shows that timezone in display", () => {
    const d = new Date("2026-05-01T09:00:00Z");
    const out = formatRun(d, "America/New_York");
    assert.ok(/America\/New_York/.test(out.display));
  });
});
