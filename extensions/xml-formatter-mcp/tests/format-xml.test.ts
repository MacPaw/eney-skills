import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import FormatXmlWidget from "../components/format-xml.js";

describe("FormatXml widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(FormatXmlWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(FormatXmlWidget, {
      input: "<root><child>x</child></root>",
      mode: "minify",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(FormatXmlWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});
