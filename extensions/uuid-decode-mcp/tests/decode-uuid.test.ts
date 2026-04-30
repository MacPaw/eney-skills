import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import DecodeUuidWidget from "../components/decode-uuid.js";

import { decodeUuid } from "../helpers/uuid.js";

describe("DecodeUuid widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(DecodeUuidWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(DecodeUuidWidget, {
      uuid: "00000000-0000-7000-8000-000000000000",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(DecodeUuidWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("decodeUuid helper", () => {
  it("identifies a v4 UUID", () => {
    const result = decodeUuid("12345678-1234-4abc-8def-1234567890ab");
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.version, 4);
      assert.equal(result.timestamp, null);
    }
  });

  it("decodes a v7 timestamp", () => {
    const result = decodeUuid("0192f0c0-0000-7000-8000-000000000000");
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.version, 7);
      assert.ok(result.timestamp instanceof Date);
    }
  });

  it("strips urn:uuid: prefix and braces", () => {
    const result = decodeUuid("{urn:uuid:12345678-1234-4abc-8def-1234567890ab}");
    assert.ok(!("error" in result));
    if (!("error" in result)) {
      assert.equal(result.canonical, "12345678-1234-4abc-8def-1234567890ab");
    }
  });

  it("rejects malformed input", () => {
    const result = decodeUuid("not-a-uuid");
    assert.ok("error" in result);
  });
});
