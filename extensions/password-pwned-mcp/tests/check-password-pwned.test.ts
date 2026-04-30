import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CheckPasswordPwnedWidget from "../components/check-password-pwned.js";

import { sha1Upper } from "../helpers/hibp.js";

describe("CheckPasswordPwned widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(CheckPasswordPwnedWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(CheckPasswordPwnedWidget, { password: "test-input" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Check action", async () => {
    const session = await createUIXTestSession(CheckPasswordPwnedWidget, { password: "x" });

    const submitBtn = session.findWidget({ title: "Check" }) ?? session.findWidget({ title: "Checking..." });
    assert.ok(submitBtn, "should have a Check button");

    session.unmount();
  });
});

describe("sha1Upper helper", () => {
  it("produces a 40-char uppercase hex digest", () => {
    const hash = sha1Upper("hello");
    assert.equal(hash.length, 40);
    assert.equal(hash, hash.toUpperCase());
    assert.match(hash, /^[0-9A-F]+$/);
  });

  it("matches the known SHA-1 of an empty string", () => {
    assert.equal(sha1Upper(""), "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709");
  });
});
