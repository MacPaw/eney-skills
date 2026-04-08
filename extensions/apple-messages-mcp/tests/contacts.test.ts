import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchContacts } from "../helpers/contacts.js";

describe("searchContacts", () => {
  it("loads all contacts when query is empty", async () => {
    const contacts = await searchContacts("");
    console.log(`Total contacts: ${contacts.length}`);
    assert.ok(contacts.length > 0, "should return at least one contact");
  });

  it("returns correct shape on each contact", async () => {
    const contacts = await searchContacts("");
    assert.ok(contacts.length > 0, "need contacts to test shape");
    const c = contacts[0];
    assert.ok(typeof c.name === "string", "name should be a string");
    assert.ok(Array.isArray(c.phones), "phones should be an array");
    assert.ok(Array.isArray(c.emails), "emails should be an array");
    console.log("sample:", c);
  });

  it("filters contacts by query", async () => {
    const all = await searchContacts("");
    const query = all[0].name.split(" ")[0].toLowerCase();
    const filtered = await searchContacts(query);
    console.log(`Query "${query}" matched ${filtered.length} of ${all.length}`);
    assert.ok(filtered.length > 0, "should match at least one contact");
    assert.ok(filtered.length <= all.length, "filtered should not exceed total");
    for (const c of filtered) {
      assert.ok(
        c.name.toLowerCase().includes(query),
        `contact "${c.name}" should match query "${query}"`,
      );
    }
  });

  it("returns empty array for non-matching query", async () => {
    const contacts = await searchContacts("zzz_no_match_zzz_xyz");
    assert.equal(contacts.length, 0, "should return empty for no match");
  });
});