import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import NamespaceUUIDWidget from "../components/make_namespace_uuid.js";
import { generate, resolveNamespace, NAMESPACE_DNS } from "../helpers/namespace-uuid.js";

describe("Namespace UUID widget", () => {
  it("renders a form when given a name", async () => {
    const session = await createUIXTestSession(NamespaceUUIDWidget, { name: "example.com" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Generate, namespace presets, version toggles, and Done", async () => {
    const session = await createUIXTestSession(NamespaceUUIDWidget, { name: "x" });

    assert.ok(session.findWidget({ title: "Generate" }), "Generate button");
    assert.ok(session.findWidget({ title: "dns" }), "dns preset");
    assert.ok(session.findWidget({ title: "v3 (MD5)" }), "v3 button");
    assert.ok(session.findWidget({ title: "v5 (SHA-1)" }), "v5 button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});

describe("namespace-uuid helpers", () => {
  it("v3 example from RFC 4122-ish — example.com under DNS namespace is well-known", () => {
    // The widely-published v3 UUID for "www.example.com" in DNS namespace is
    // 5df41881-3aed-3515-88a7-2f4a814cf09e
    assert.equal(generate(3, "dns", "www.example.com"), "5df41881-3aed-3515-88a7-2f4a814cf09e");
  });

  it("v5 of 'www.example.com' under DNS is the canonical 2ed6657d-…", () => {
    // Well-known v5 UUID
    assert.equal(generate(5, "dns", "www.example.com"), "2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("same input always produces the same UUID (deterministic)", () => {
    const a = generate(5, "url", "https://example.com/foo");
    const b = generate(5, "url", "https://example.com/foo");
    assert.equal(a, b);
  });

  it("different version yields different UUID for same input", () => {
    const v3 = generate(3, "dns", "abc");
    const v5 = generate(5, "dns", "abc");
    assert.notEqual(v3, v5);
  });

  it("resolveNamespace handles preset names and UUID literals", () => {
    assert.equal(resolveNamespace("dns"), NAMESPACE_DNS);
    assert.equal(resolveNamespace("DNS"), NAMESPACE_DNS);
    const custom = "12345678-1234-1234-1234-1234567890ab";
    assert.equal(resolveNamespace(custom), custom);
  });

  it("resolveNamespace rejects garbage", () => {
    assert.throws(() => resolveNamespace("not-a-thing"));
  });
});
