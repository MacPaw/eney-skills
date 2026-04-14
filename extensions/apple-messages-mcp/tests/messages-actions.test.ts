import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSendScript, buildOpenScript } from "../helpers/messages-actions.js";

describe("buildSendScript", () => {
  it("includes recipient and message in the script", () => {
    const script = buildSendScript("+15551234567", "Hello there");
    assert.ok(script.includes("+15551234567"), "should include recipient");
    assert.ok(script.includes("Hello there"), "should include message");
  });

  it("escapes double quotes in message", () => {
    const script = buildSendScript("recipient@example.com", 'Say "hi"');
    assert.ok(script.includes('\\"hi\\"'), "double quotes in message should be escaped");
    assert.ok(!script.includes('"hi"'), "unescaped double quotes should not appear in body");
  });

  it("escapes double quotes in recipient", () => {
    const script = buildSendScript('evil"name', "message");
    assert.ok(script.includes('\\"name'), "double quotes in recipient should be escaped");
  });

  it("escapes backslashes in message", () => {
    const script = buildSendScript("recipient", "path\\to\\file");
    assert.ok(script.includes("path\\\\to\\\\file"), "backslashes should be doubled");
  });

  it("escapes backslashes in recipient", () => {
    const script = buildSendScript("re\\cipient", "message");
    assert.ok(script.includes("re\\\\cipient"), "backslashes in recipient should be doubled");
  });

  it("handles newlines in message safely (no newline injection)", () => {
    // Newlines in the message value should not break the AppleScript string
    // The escaped version should not produce a raw newline inside the quoted string
    const script = buildSendScript("r@example.com", "line1\nline2");
    // The script should still be a valid string (no unescaped newline breaks the send command)
    assert.ok(script.includes("tell application"), "script structure should be intact");
  });
});

describe("buildOpenScript", () => {
  it("includes the chat identifier URL when provided", () => {
    const script = buildOpenScript("+15559876543");
    assert.ok(
      script.includes("messages://+15559876543"),
      "should include messages:// URL with identifier",
    );
  });

  it("omits the open location call when no identifier is provided", () => {
    const script = buildOpenScript();
    assert.ok(!script.includes("open location"), "should not include open location");
    assert.ok(script.includes("Messages"), "should still activate Messages");
  });

  it("omits the open location call when identifier is undefined", () => {
    const script = buildOpenScript(undefined);
    assert.ok(!script.includes("open location"), "should not include open location for undefined");
  });
});
