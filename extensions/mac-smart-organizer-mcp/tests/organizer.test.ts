import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanDirectory, listSubdirectories, formatBytes, buildPlan } from "../helpers/organizer.js";

let tmpDir: string;

describe("organizer helpers", () => {
  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "eney-test-"));
    await writeFile(join(tmpDir, "invoice-march.pdf"), "data");
    await writeFile(join(tmpDir, "photo.jpg"), "img");
    await writeFile(join(tmpDir, ".DS_Store"), "junk");
    await writeFile(join(tmpDir, ".hidden"), "hidden");
    await mkdir(join(tmpDir, "ExistingFolder"));
  });

  after(async () => { await rm(tmpDir, { recursive: true, force: true }); });

  it("scanDirectory returns only files, skips dotfiles and .DS_Store", async () => {
    const files = await scanDirectory(tmpDir);
    const names = files.map((f) => f.name);
    assert.ok(names.includes("invoice-march.pdf"));
    assert.ok(names.includes("photo.jpg"));
    assert.ok(!names.includes(".DS_Store"));
    assert.ok(!names.includes(".hidden"), "should skip dotfiles");
  });

  it("listSubdirectories returns directory names", async () => {
    const dirs = await listSubdirectories(tmpDir);
    assert.ok(dirs.includes("ExistingFolder"));
  });

  it("formatBytes formats correctly", () => {
    assert.equal(formatBytes(500), "500 B");
    assert.equal(formatBytes(2048), "2.0 KB");
    assert.equal(formatBytes(2 * 1024 * 1024), "2.0 MB");
  });

  it("buildPlan categorizes known extensions without LLM", async () => {
    const plan = await buildPlan(tmpDir, {
      applyFinderTags: false,
      renameFiles: false,
      duplicateHandling: "skip",
      archiveDaysThreshold: 0,
    });
    assert.ok(plan.totalFiles >= 2);
    const moveActions = plan.actions.filter((a) => a.type === "move");
    assert.ok(moveActions.length >= 1, "should have at least one move");
  });
});
