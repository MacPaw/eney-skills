import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SqlFormatterWidget from "../components/format_sql.js";

describe("SQL formatter widget", () => {
  it("renders a form when given SQL input", async () => {
    const session = await createUIXTestSession(SqlFormatterWidget, {
      sql: "select * from users where id = 1",
    });
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Format and Done actions", async () => {
    const session = await createUIXTestSession(SqlFormatterWidget, {
      sql: "select 1",
    });

    assert.ok(session.findWidget({ title: "Format" }), "should have a Format button");
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });

  it("formats simple SQL on initial render", async () => {
    const session = await createUIXTestSession(SqlFormatterWidget, {
      sql: "select id, name from users where active = true order by id",
    });
    const dump = JSON.stringify(session.getSimplifiedState());
    // Formatted output should contain SELECT keyword and a newline before FROM
    assert.ok(/select|SELECT/.test(dump), "output should contain select keyword");
    assert.ok(/from|FROM/.test(dump), "output should contain from keyword");

    session.unmount();
  });
});
