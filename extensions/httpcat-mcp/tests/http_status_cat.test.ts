import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import HttpCatWidget from "../components/http_status_cat.js";

describe("HTTP Cat widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(HttpCatWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Show, Random, preset codes, and Done", async () => {
    const session = await createUIXTestSession(HttpCatWidget);

    assert.ok(session.findWidget({ title: "Show" }), "Show button");
    assert.ok(session.findWidget({ title: "Random" }), "Random button");
    assert.ok(session.findWidget({ title: "404" }), "404 preset");
    assert.ok(session.findWidget({ title: "418" }), "418 preset");
    assert.ok(session.findWidget({ title: "500" }), "500 preset");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });

  it("includes HTTP code label for 418", async () => {
    const session = await createUIXTestSession(HttpCatWidget, { code: 418 });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/teapot/i.test(dump), "should mention teapot");
    session.unmount();
  });

  it("uses provided code in image URL", async () => {
    const session = await createUIXTestSession(HttpCatWidget, { code: 404 });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/http\.cat\/404/.test(dump), "should reference /404 image");
    session.unmount();
  });
});
