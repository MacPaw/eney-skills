import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import DogImageWidget from "../components/get_dog_image.js";

describe("Dog image widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(DogImageWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Fetch, Another One, Any Breed, and Done actions", async () => {
    const session = await createUIXTestSession(DogImageWidget);

    assert.ok(session.findWidget({ title: "Fetch" }), "should have Fetch button");
    assert.ok(session.findWidget({ title: "Another One" }), "should have Another One button");
    assert.ok(session.findWidget({ title: "Any Breed" }), "should have Any Breed button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
