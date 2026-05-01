import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import BundleSizeWidget from "../components/get_bundle_size.js";

describe("Bundle size widget", () => {
  it("renders a form when given a package", async () => {
    const session = await createUIXTestSession(BundleSizeWidget, { package: "react" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up and Done", async () => {
    const session = await createUIXTestSession(BundleSizeWidget, { package: "react" });
    assert.ok(session.findWidget({ title: "Look Up" }), "Look Up button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
