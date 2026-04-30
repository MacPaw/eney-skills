import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import GenerateTocWidget from "../components/generate-toc.js";

import { extractHeadings, renderToc, slugify } from "../helpers/toc.js";

describe("GenerateToc widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(GenerateTocWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Done action", async () => {
    const session = await createUIXTestSession(GenerateTocWidget);

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});

describe("toc helpers", () => {
  it("slugifies in GitHub style", () => {
    assert.equal(slugify("Hello, World!"), "hello-world");
    assert.equal(slugify("Café Münchner"), "cafe-munchner");
  });

  it("extracts headings within the level range", () => {
    const md = "# H1\n\n## H2\n\n### H3\n\n#### H4\n";
    const headings = extractHeadings(md, 2, 3);
    assert.deepEqual(
      headings.map((h) => h.text),
      ["H2", "H3"],
    );
  });

  it("skips headings inside fenced code blocks", () => {
    const md = "## Real heading\n\n```\n## Inside code\n```\n\n## Another real\n";
    const headings = extractHeadings(md, 1, 6);
    assert.deepEqual(
      headings.map((h) => h.text),
      ["Real heading", "Another real"],
    );
  });

  it("disambiguates duplicate slugs", () => {
    const md = "## Setup\n\n## Setup\n";
    const headings = extractHeadings(md, 1, 6);
    assert.deepEqual(
      headings.map((h) => h.slug),
      ["setup", "setup-1"],
    );
  });

  it("indents nested headings relative to the shallowest", () => {
    const md = "## Top\n\n### Nested\n";
    const toc = renderToc(extractHeadings(md, 1, 6), 2);
    assert.equal(toc, "- [Top](#top)\n  - [Nested](#nested)");
  });
});
