import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CaptureToObsidianWidget from "../components/capture-to-obsidian.js";

describe("CaptureToObsidian widget", () => {
it("renders with default props", async () => {
const session = await createUIXTestSession(CaptureToObsidianWidget);
const state = session.getSimplifiedState();

const form = state.children?.find((c) => c.type === "form");
assert.ok(form, "should render a form");

session.unmount();
});

it("closes widget on Done action", async () => {
const session = await createUIXTestSession(CaptureToObsidianWidget);

const doneBtn = session.findWidget({ title: "Done" });
assert.ok(doneBtn, "should have a Done button");
await session.click(doneBtn!);

assert.equal(session.closedWith, "Done");

session.unmount();
});
});
