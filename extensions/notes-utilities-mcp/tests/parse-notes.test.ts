import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseNotes } from "../helpers/use-notes.js";

describe("parseNotes", () => {
  it("parses notes from AppleScript output", () => {
    const raw = [
      "x-coredata://abc/ICNote/p1|Work|Meeting notes",
      "x-coredata://abc/ICNote/p2|Personal|Shopping list",
    ].join("\n");

    const result = parseNotes(raw);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], {
      id: "x-coredata://abc/ICNote/p1",
      folder: "Work",
      title: "Meeting notes",
    });
    assert.deepEqual(result[1], {
      id: "x-coredata://abc/ICNote/p2",
      folder: "Personal",
      title: "Shopping list",
    });
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(parseNotes(""), []);
    assert.deepEqual(parseNotes("  "), []);
  });

  it("deduplicates notes by id", () => {
    const raw = [
      "id1|Folder|Note A",
      "id1|Folder|Note A duplicate",
      "id2|Folder|Note B",
    ].join("\n");

    const result = parseNotes(raw);

    assert.equal(result.length, 2);
    assert.equal(result[0].title, "Note A");
    assert.equal(result[1].title, "Note B");
  });

  it("skips malformed lines", () => {
    const raw = [
      "id1|Folder|Valid note",
      "missing-separator",
      "only|one",
      "",
      "id2|Folder|Another valid",
    ].join("\n");

    const result = parseNotes(raw);

    assert.equal(result.length, 2);
    assert.equal(result[0].title, "Valid note");
    assert.equal(result[1].title, "Another valid");
  });

  it("trims whitespace from fields", () => {
    const raw = "  id1  |  My Folder  |  My Note  ";
    const result = parseNotes(raw);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "id1");
    assert.equal(result[0].folder, "My Folder");
    assert.equal(result[0].title, "My Note");
  });
});
