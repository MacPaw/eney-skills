import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ConvertRomanWidget from "../components/convert-roman.js";

import { intToRoman, romanToInt } from "../helpers/roman.js";

describe("ConvertRoman widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(ConvertRomanWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(ConvertRomanWidget, { input: "1994" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(ConvertRomanWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("roman helpers", () => {
  it("converts integers to canonical Roman", () => {
    assert.equal(intToRoman(1), "I");
    assert.equal(intToRoman(4), "IV");
    assert.equal(intToRoman(9), "IX");
    assert.equal(intToRoman(1994), "MCMXCIV");
    assert.equal(intToRoman(3999), "MMMCMXCIX");
  });

  it("rejects out-of-range integers", () => {
    assert.throws(() => intToRoman(0));
    assert.throws(() => intToRoman(4000));
    assert.throws(() => intToRoman(1.5));
  });

  it("decodes canonical Roman numerals", () => {
    assert.equal(romanToInt("MCMXCIV"), 1994);
    assert.equal(romanToInt("xiv"), 14);
  });

  it("rejects non-canonical forms", () => {
    assert.throws(() => romanToInt("IIII"));
    assert.throws(() => romanToInt("VV"));
    assert.throws(() => romanToInt("IC"));
  });
});
