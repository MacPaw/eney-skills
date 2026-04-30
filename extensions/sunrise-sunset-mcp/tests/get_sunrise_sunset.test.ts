import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SunriseSunsetWidget from "../components/get_sunrise_sunset.js";

describe("SunriseSunset widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(SunriseSunsetWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(SunriseSunsetWidget);

    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });
});
