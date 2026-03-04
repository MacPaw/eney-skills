import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePassword } from "../components/generate-password.js";

describe("generatePassword", () => {
  it("returns empty string when length is null", () => {
    assert.equal(
      generatePassword({ length: null, symbols: true, numbers: true }),
      "",
    );
  });

  it("returns empty string when length is 0", () => {
    assert.equal(
      generatePassword({ length: 0, symbols: true, numbers: true }),
      "",
    );
  });

  it("generates password of requested length", () => {
    const password = generatePassword({
      length: 20,
      symbols: true,
      numbers: true,
    });
    assert.equal(password.length, 20);
  });

  it("caps length at 128", () => {
    const password = generatePassword({
      length: 200,
      symbols: true,
      numbers: true,
    });
    assert.equal(password.length, 128);
  });

  it("includes letters only when symbols and numbers are disabled", () => {
    const password = generatePassword({
      length: 50,
      symbols: false,
      numbers: false,
    });
    assert.match(password, /^[a-zA-Z]+$/);
  });

  it("includes at least one number when numbers enabled", () => {
    for (let i = 0; i < 10; i++) {
      const password = generatePassword({
        length: 20,
        symbols: false,
        numbers: true,
      });
      assert.match(password, /[0-9]/, "should contain at least one digit");
    }
  });

  it("includes at least one symbol when symbols enabled", () => {
    for (let i = 0; i < 10; i++) {
      const password = generatePassword({
        length: 20,
        symbols: true,
        numbers: false,
      });
      assert.match(
        password,
        /[!@#$%^&*?_~]/,
        "should contain at least one symbol",
      );
    }
  });

  it("includes both numbers and symbols when both enabled", () => {
    for (let i = 0; i < 10; i++) {
      const password = generatePassword({
        length: 20,
        symbols: true,
        numbers: true,
      });
      assert.match(password, /[0-9]/, "should contain a digit");
      assert.match(password, /[!@#$%^&*?_~]/, "should contain a symbol");
    }
  });

  it("generates different passwords on each call", () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () =>
        generatePassword({ length: 20, symbols: true, numbers: true }),
      ),
    );
    assert.ok(passwords.size > 1, "should generate unique passwords");
  });
});
