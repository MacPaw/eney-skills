import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@macpaw/eney-api/testing";
import NewPasswordWidget from "../components/new-password.js";

describe("NewPassword widget", () => {
  it("renders with default props", async () => {
    const session = await createUIXTestSession(NewPasswordWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("generates a password on mount", async () => {
    const session = await createUIXTestSession(NewPasswordWidget);
    const passwordField = session.findWidget({ name: "password" });

    assert.ok(passwordField, "should have a password field");
    const value = String(passwordField!.properties.value ?? "");
    assert.ok(value.length > 0, "should generate a password on mount");

    session.unmount();
  });

  it("uses provided length prop", async () => {
    const session = await createUIXTestSession(NewPasswordWidget, {
      length: 10,
    });
    const passwordField = session.findWidget({ name: "password" });

    const value = String(passwordField!.properties.value ?? "");
    assert.equal(value.length, 10);

    session.unmount();
  });

  it("respects symbols=false prop", async () => {
    const session = await createUIXTestSession(NewPasswordWidget, {
      length: 50,
      symbols: false,
      numbers: false,
    });
    const passwordField = session.findWidget({ name: "password" });

    const value = String(passwordField!.properties.value ?? "");
    assert.match(value, /^[a-zA-Z]+$/, "should only contain letters");

    session.unmount();
  });

  it("regenerates password when toggling numbers", async () => {
    const session = await createUIXTestSession(NewPasswordWidget, {
      length: 30,
      symbols: false,
      numbers: false,
    });

    const before = String(
      session.findWidget({ name: "password" })!.properties.value ?? "",
    );
    assert.match(before, /^[a-zA-Z]+$/);

    const numbersToggle = session.findWidget({ name: "numbers" });
    assert.ok(numbersToggle, "should have a numbers toggle");
    await session.check(numbersToggle!);

    const after = String(
      session.findWidget({ name: "password" })!.properties.value ?? "",
    );
    assert.match(
      after,
      /[0-9]/,
      "should contain a digit after enabling numbers",
    );

    session.unmount();
  });

  it("regenerates password when toggling symbols", async () => {
    const session = await createUIXTestSession(NewPasswordWidget, {
      length: 30,
      symbols: false,
      numbers: false,
    });

    const symbolsToggle = session.findWidget({ name: "symbols" });
    assert.ok(symbolsToggle, "should have a symbols toggle");
    await session.check(symbolsToggle!);

    const after = String(
      session.findWidget({ name: "password" })!.properties.value ?? "",
    );
    assert.match(
      after,
      /[!@#$%^&*?_~]/,
      "should contain a symbol after enabling symbols",
    );

    session.unmount();
  });

  it("regenerates password on Generate button click", async () => {
    const session = await createUIXTestSession(NewPasswordWidget, {
      length: 20,
    });

    const generateBtn = session.findWidget({ title: "Generate" });
    assert.ok(generateBtn, "should have a Generate button");
    await session.click(generateBtn!);

    const after = String(
      session.findWidget({ name: "password" })!.properties.value ?? "",
    );
    assert.ok(after.length === 20, "password should still be 20 chars");

    session.unmount();
  });

  it("closes widget with password on Done click", async () => {
    const session = await createUIXTestSession(NewPasswordWidget, {
      length: 12,
    });

    const password = String(
      session.findWidget({ name: "password" })!.properties.value ?? "",
    );
    assert.ok(password.length > 0);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");
    await session.click(doneBtn!);

    assert.equal(session.closedWith, `Generated password: ${password}`);

    session.unmount();
  });

  it("renders length field with max 128", async () => {
    const session = await createUIXTestSession(NewPasswordWidget);
    const lengthField = session.findWidget({ name: "length" });

    assert.ok(lengthField, "should have a length field");
    assert.equal(lengthField!.properties.max, 128);

    session.unmount();
  });

  it("renders checkboxes with correct initial state", async () => {
    const session = await createUIXTestSession(NewPasswordWidget);

    const symbolsToggle = session.findWidget({ name: "symbols" });
    const numbersToggle = session.findWidget({ name: "numbers" });

    assert.ok(symbolsToggle, "should have a symbols toggle");
    assert.ok(numbersToggle, "should have a numbers toggle");
    assert.equal(
      symbolsToggle!.properties.value,
      true,
      "symbols should default to true",
    );
    assert.equal(
      numbersToggle!.properties.value,
      true,
      "numbers should default to true",
    );

    session.unmount();
  });
});
