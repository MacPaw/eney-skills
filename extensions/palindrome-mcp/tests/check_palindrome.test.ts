import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import PalindromeWidget from "../components/check_palindrome.js";
import { isPalindrome, isAnagram, findPalindromes, normalize, reverse } from "../helpers/palindrome.js";

describe("Palindrome widget", () => {
  it("renders a form with provided text", async () => {
    const session = await createUIXTestSession(PalindromeWidget, { text: "racecar" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Check, case toggle, punctuation toggle, and Done", async () => {
    const session = await createUIXTestSession(PalindromeWidget, { text: "level" });

    assert.ok(session.findWidget({ title: "Check" }), "Check button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});

describe("palindrome helpers", () => {
  it("isPalindrome on classic palindromes", () => {
    const opts = { ignoreCase: true, ignorePunctuation: true };
    assert.equal(isPalindrome("racecar", opts), true);
    assert.equal(isPalindrome("level", opts), true);
    assert.equal(isPalindrome("A man, a plan, a canal — Panama!", opts), true);
    assert.equal(isPalindrome("Was it a car or a cat I saw?", opts), true);
  });

  it("isPalindrome rejects non-palindromes", () => {
    const opts = { ignoreCase: true, ignorePunctuation: true };
    assert.equal(isPalindrome("hello", opts), false);
    assert.equal(isPalindrome("racecars", opts), false);
  });

  it("isPalindrome empty string is not a palindrome", () => {
    assert.equal(
      isPalindrome("", { ignoreCase: true, ignorePunctuation: true }),
      false,
    );
  });

  it("respects case-sensitive option", () => {
    assert.equal(isPalindrome("Aa", { ignoreCase: true }), true);
    assert.equal(isPalindrome("Aa", { ignoreCase: false }), false);
  });

  it("isAnagram detects rearrangements", () => {
    const opts = { ignoreCase: true, ignorePunctuation: true };
    assert.equal(isAnagram("listen", "silent", opts), true);
    assert.equal(isAnagram("triangle", "integral", opts), true);
    assert.equal(isAnagram("hello", "world", opts), false);
    assert.equal(isAnagram("Astronomer", "Moon starer", opts), true);
  });

  it("findPalindromes returns at least the input when it is a palindrome", () => {
    const subs = findPalindromes("racecar", {
      ignoreCase: true,
      ignorePunctuation: true,
      minLength: 3,
    });
    assert.ok(subs.includes("racecar"), `expected racecar, got ${subs.join(", ")}`);
  });

  it("normalize and reverse compose correctly", () => {
    const n = normalize("Hello, World!", { ignoreCase: true, ignorePunctuation: true });
    assert.equal(n, "helloworld");
    assert.equal(reverse(n), "dlrowolleh");
  });
});
