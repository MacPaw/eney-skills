import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import GitHubUserWidget from "../components/get_github_user.js";

describe("GitHub user widget", () => {
  it("renders a form when given a username", async () => {
    const session = await createUIXTestSession(GitHubUserWidget, { username: "octocat" });
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Look Up and Done actions", async () => {
    const session = await createUIXTestSession(GitHubUserWidget, { username: "octocat" });

    assert.ok(session.findWidget({ title: "Look Up" }), "should have Look Up button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
