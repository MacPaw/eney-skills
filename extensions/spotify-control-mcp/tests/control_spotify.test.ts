import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SpotifyControlWidget from "../components/control_spotify.js";
import { formatTime } from "../helpers/spotify.js";

describe("Spotify control widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(SpotifyControlWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has playback controls and Done", async () => {
    const session = await createUIXTestSession(SpotifyControlWidget);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Play / Pause" }), "Play/Pause button");
    assert.ok(session.findWidget({ title: "Play" }), "Play button");
    assert.ok(session.findWidget({ title: "Pause" }), "Pause button");
    assert.ok(session.findWidget({ title: "Next" }), "Next button");
    assert.ok(session.findWidget({ title: "Previous" }), "Previous button");
    assert.ok(session.findWidget({ title: "Set volume" }), "Set volume button");
    assert.ok(session.findWidget({ title: "Open URI" }), "Open URI button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("spotify helpers", () => {
  it("formatTime renders mm:ss", () => {
    assert.equal(formatTime(0), "0:00");
    assert.equal(formatTime(15_000), "0:15");
    assert.equal(formatTime(75_000), "1:15");
    assert.equal(formatTime(605_500), "10:06");
  });
});
