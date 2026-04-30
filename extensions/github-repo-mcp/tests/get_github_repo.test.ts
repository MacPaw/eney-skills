import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import GithubRepoWidget from "../components/get_github_repo.js";

describe("GitHub repo widget", () => {
  it("renders a form with owner/repo", async () => {
    const session = await createUIXTestSession(GithubRepoWidget, {
      owner: "facebook",
      repo: "react",
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("accepts owner/repo combined in owner field", async () => {
    const session = await createUIXTestSession(GithubRepoWidget, {
      owner: "facebook/react",
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up and Done actions", async () => {
    const session = await createUIXTestSession(GithubRepoWidget, {
      owner: "facebook",
      repo: "react",
    });

    assert.ok(session.findWidget({ title: "Look Up" }), "should have Look Up button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
