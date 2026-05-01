import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import AspectRatioWidget from "../components/compute_aspect_ratio.js";
import { reduce, fromOneDimension } from "../helpers/aspect.js";

describe("Aspect ratio widget", () => {
  it("renders a form with required props", async () => {
    const session = await createUIXTestSession(AspectRatioWidget, {
      width: 1920,
      height: 1080,
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Compute, presets, scale actions, and Done", async () => {
    const session = await createUIXTestSession(AspectRatioWidget, {
      width: 1920,
      height: 1080,
    });

    assert.ok(session.findWidget({ title: "Compute" }), "Compute button");
    assert.ok(session.findWidget({ title: "HD 1920×1080" }), "HD preset");
    assert.ok(session.findWidget({ title: "Scale to 1920w" }), "Scale to width");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});

describe("aspect helpers", () => {
  it("1920×1080 reduces to 16:9", () => {
    const r = reduce(1920, 1080);
    assert.equal(r.num, 16);
    assert.equal(r.den, 9);
  });

  it("1024×768 reduces to 4:3", () => {
    const r = reduce(1024, 768);
    assert.equal(r.num, 4);
    assert.equal(r.den, 3);
  });

  it("3840×2160 reduces to 16:9 and identifies the named ratio", () => {
    const r = reduce(3840, 2160);
    assert.equal(r.num, 16);
    assert.equal(r.den, 9);
    assert.ok(r.named && r.named.includes("16:9"));
  });

  it("1080×1080 reduces to 1:1 (square)", () => {
    const r = reduce(1080, 1080);
    assert.equal(r.num, 1);
    assert.equal(r.den, 1);
    assert.ok(r.named && r.named.includes("1:1"));
  });

  it("rejects zero/negative dimensions", () => {
    assert.throws(() => reduce(0, 100));
    assert.throws(() => reduce(100, 0));
    assert.throws(() => reduce(-1, 1));
  });

  it("fromOneDimension scales preserving the ratio", () => {
    const a = fromOneDimension(16, 9, 1920, undefined);
    assert.equal(a.height, 1080);
    const b = fromOneDimension(16, 9, undefined, 1080);
    assert.equal(b.width, 1920);
  });
});
