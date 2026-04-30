import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MacVendorWidget from "../components/lookup_mac_vendor.js";

describe("MAC vendor widget", () => {
  it("renders a form with given MAC", async () => {
    const session = await createUIXTestSession(MacVendorWidget, {
      mac: "04:CF:8C:AC:90:6F",
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up and Done actions", async () => {
    const session = await createUIXTestSession(MacVendorWidget, {
      mac: "04CF8C",
    });

    assert.ok(session.findWidget({ title: "Look Up" }), "Look Up button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });

  it("rejects too-short input cleanly", async () => {
    const session = await createUIXTestSession(MacVendorWidget, {
      mac: "AB",
    });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/Error|hex/i.test(dump), "should show error for short input");
    session.unmount();
  });
});
