import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ShowDiskUsageWidget from "../components/show-disk-usage.js";

import { formatBytes } from "../helpers/df.js";

describe("ShowDiskUsage widget", () => {
  it("renders a form in loading state", async () => {
    const session = await createUIXTestSession(ShowDiskUsageWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ShowDiskUsageWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("formatBytes helper", () => {
  it("formats common sizes", () => {
    assert.equal(formatBytes(0), "0.00 B");
    assert.equal(formatBytes(1), "1.00 KB");
    assert.equal(formatBytes(1024), "1.00 MB");
    assert.equal(formatBytes(1024 * 1024), "1.00 GB");
    assert.equal(formatBytes(1024 * 1024 * 1024), "1.00 TB");
  });

  it("uses fewer decimals for larger magnitudes", () => {
    assert.equal(formatBytes(150 * 1024), "150 MB");
    assert.equal(formatBytes(50 * 1024), "50.0 MB");
  });
});
