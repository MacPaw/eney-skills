import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import AirQualityWidget from "../components/get_air_quality.js";

describe("Air quality widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(AirQualityWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh and Done actions", async () => {
    const session = await createUIXTestSession(AirQualityWidget);

    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});
