import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { Reminder, listReminderLists, listReminders } from "../helpers/reminders.js";

const schema = z.object({
  list: z.string().optional().describe("The reminder list name. Defaults to the first available list."),
  includeCompleted: z.boolean().optional().describe("Include completed reminders. Defaults to false."),
});

type Props = z.infer<typeof schema>;

function ListReminders(props: Props) {
  const closeWidget = useCloseWidget();
  const [list, setList] = useState(props.list ?? "");
  const [includeCompleted, setIncludeCompleted] = useState(props.includeCompleted ?? false);
  const [lists, setLists] = useState<string[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listReminderLists()
      .then((available) => {
        setLists(available);
        if (!list && available.length) setList(available[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingLists(false));
  }, []);

  useEffect(() => {
    if (!list) return;
    setIsLoadingReminders(true);
    setError("");
    listReminders(list, includeCompleted)
      .then(setReminders)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingReminders(false));
  }, [list, includeCompleted]);

  function onDone() {
    closeWidget(`${reminders.length} reminder(s) shown from "${list}".`);
  }

  const header = <CardHeader title="Reminders" iconBundleId="com.apple.reminders" />;
  const actions = (
    <ActionPanel>
      <Action title="Done" onAction={onDone} style="primary" />
    </ActionPanel>
  );

  if (isLoadingLists) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading reminder lists..." />
      </Form>
    );
  }

  const lines: string[] = [];
  if (isLoadingReminders) {
    lines.push("Loading reminders...");
  } else if (!reminders.length) {
    lines.push(`_No${includeCompleted ? "" : " incomplete"} reminders in "${list}"._`);
  } else {
    for (const r of reminders) {
      const due = r.dueDate ? ` _(${r.dueDate})_` : "";
      lines.push(`- **${r.name}**${due}`);
      if (r.body) lines.push(`  ${r.body.split("\n").join(" ")}`);
    }
  }

  return (
    <Form header={header} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {lists.length > 0 && (
        <Form.Dropdown name="list" label="List" value={list} onChange={setList}>
          {lists.map((l) => (
            <Form.Dropdown.Item key={l} title={l} value={l} />
          ))}
        </Form.Dropdown>
      )}
      <Form.Checkbox
        name="includeCompleted"
        label="Show completed"
        checked={includeCompleted}
        onChange={setIncludeCompleted}
        variant="switch"
      />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ListRemindersWidget = defineWidget({
  name: "list-reminders",
  description: "List reminders from an Apple Reminders list, optionally including completed ones.",
  schema,
  component: ListReminders,
});

export default ListRemindersWidget;
