import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CurrentWeatherWidget from "../components/current-weather.js";

describe("CurrentWeather widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(CurrentWeatherWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(CurrentWeatherWidget, {
      location: "Kyiv",
      unit: "f",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Get Weather action", async () => {
    const session = await createUIXTestSession(CurrentWeatherWidget, { location: "Kyiv" });

    const submitBtn =
      session.findWidget({ title: "Get Weather" }) ?? session.findWidget({ title: "Looking up..." });
    assert.ok(submitBtn, "should have a Get Weather button");

    session.unmount();
  });
});
