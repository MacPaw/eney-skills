import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import TileWindowWidget from "../components/tile_window.js";
import { regionToFrame } from "../helpers/tile.js";

describe("Tile window widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(TileWindowWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh, region presets, and Done", async () => {
    const session = await createUIXTestSession(TileWindowWidget);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Left ½" }), "Left half preset");
    assert.ok(session.findWidget({ title: "Right ½" }), "Right half preset");
    assert.ok(session.findWidget({ title: "Full" }), "Full preset");
    assert.ok(session.findWidget({ title: "Center (60%)" }), "Center preset");
    assert.ok(session.findWidget({ title: "Top-left ¼" }), "Top-left quarter");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("tile helpers", () => {
  const screen = { x: 0, y: 0, width: 1920, height: 1080 };

  it("left-half = left half of screen", () => {
    const f = regionToFrame("left-half", screen);
    assert.deepEqual(f, { x: 0, y: 0, width: 960, height: 1080 });
  });

  it("right-half covers right half", () => {
    const f = regionToFrame("right-half", screen);
    assert.deepEqual(f, { x: 960, y: 0, width: 960, height: 1080 });
  });

  it("full uses whole screen", () => {
    const f = regionToFrame("full", screen);
    assert.deepEqual(f, { x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("top-right quarter", () => {
    const f = regionToFrame("top-right", screen);
    assert.deepEqual(f, { x: 960, y: 0, width: 960, height: 540 });
  });

  it("center is 60% of each dimension", () => {
    const f = regionToFrame("center", screen);
    assert.equal(f.width, 1152);
    assert.equal(f.height, 648);
    // centred
    assert.equal(f.x, 384);
    assert.equal(f.y, 216);
  });

  it("thirds split horizontally", () => {
    const left = regionToFrame("left-third", screen);
    const middle = regionToFrame("middle-third", screen);
    const right = regionToFrame("right-third", screen);
    assert.equal(left.x, 0);
    assert.equal(middle.x, 640);
    assert.equal(right.x, 1280);
    // Right third absorbs rounding remainder so the three add up to 1920
    assert.equal(left.width + middle.width + right.width, 1920);
  });

  it("respects a non-zero screen origin", () => {
    const f = regionToFrame("left-half", { x: 100, y: 50, width: 800, height: 600 });
    assert.deepEqual(f, { x: 100, y: 50, width: 400, height: 600 });
  });
});
