import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ConvertTimeZoneWidget from "../components/convert-time-zone.js";

import { formatInZone, wallClockInZoneToUtc } from "../helpers/zones.js";

describe("ConvertTimeZone widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(ConvertTimeZoneWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(ConvertTimeZoneWidget, {
      iso: "2026-06-01T12:00:00Z",
      sourceZone: "Europe/Kyiv",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ConvertTimeZoneWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("wallClockInZoneToUtc helper", () => {
  it("treats wall-clock UTC as UTC", () => {
    const utc = wallClockInZoneToUtc(2026, 6, 1, 12, 0, "UTC");
    assert.equal(utc.toISOString(), "2026-06-01T12:00:00.000Z");
  });

  it("converts wall-clock NYC summer (EDT, UTC-4) to UTC", () => {
    const utc = wallClockInZoneToUtc(2026, 7, 15, 9, 0, "America/New_York");
    assert.equal(utc.toISOString(), "2026-07-15T13:00:00.000Z");
  });

  it("converts wall-clock NYC winter (EST, UTC-5) to UTC", () => {
    const utc = wallClockInZoneToUtc(2026, 1, 15, 9, 0, "America/New_York");
    assert.equal(utc.toISOString(), "2026-01-15T14:00:00.000Z");
  });
});

describe("formatInZone helper", () => {
  it("formats a UTC instant in another zone", () => {
    const out = formatInZone(new Date("2026-06-01T12:00:00Z"), "America/New_York");
    assert.match(out, /^2026-06-01 08:00:00/);
  });
});
