import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isScreenshot } from "../helpers/ocr.js";

describe("isScreenshot", () => {
  it("returns true for Screenshot*.png", () => {
    assert.ok(isScreenshot("Screenshot 2024-01-01.png"));
  });

  it("returns true for screen_shot*.jpg", () => {
    assert.ok(isScreenshot("screen_shot.jpg"));
  });

  it("returns true for снимок экрана*.png (Russian macOS)", () => {
    assert.ok(isScreenshot("снимок экрана 2024-01-01.png"));
  });

  it("returns false for IMG_1234.jpg", () => {
    assert.strictEqual(isScreenshot("IMG_1234.jpg"), false);
  });

  it("returns false for document.pdf", () => {
    assert.strictEqual(isScreenshot("document.pdf"), false);
  });

  it("returns false for screenshot.pdf (wrong extension)", () => {
    assert.strictEqual(isScreenshot("screenshot.pdf"), false);
  });
});
