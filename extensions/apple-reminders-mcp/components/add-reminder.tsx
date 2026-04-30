import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { addReminder, listReminderLists } from "../helpers/reminders.js";

const schema = z.object({
  name: z.string().optional().describe("The reminder title."),
  body: z.string().optional().describe("Optional notes for the reminder."),
  list: z.string().optional().describe("The reminder list name. Defaults to the first available list."),
  dueDate: z.string().optional().describe("Optional ISO 8601 due date/time, e.g. 2026-05-01T09:00:00."),
});

type Props = z.infer<typeof schema>;

function parseProvidedDueDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function AddReminder(props: Props) {
  const closeWidget = useCloseWidget();
  const [name, setName] = useState(props.name ?? "");
  const [body, setBody] = useState(props.body ?? "");
  const [list, setList] = useState(props.list ?? "");
  const [hasDueDate, setHasDueDate] = useState(!!props.dueDate);
  const [dueDate, setDueDate] = useState<Date | null>(parseProvidedDueDate(props.dueDate));
  const [lists, setLists] = useState<string[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  async function onSubmit() {
    if (!name.trim() || !list) return;
    setIsSaving(true);
    setError("");
    try {
      await addReminder({
        list,
        name: name.trim(),
        body: body.trim() || undefined,
        dueDate: hasDueDate && dueDate ? dueDate : undefined,
      });
      closeWidget(`Added "${name.trim()}" to "${list}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsSaving(false);
    }
  }

  const header = <CardHeader title="Add Reminder" iconBundleId="com.apple.reminders" />;
  const actions = (
    <ActionPanel>
      <Action.SubmitForm
        title={isSaving ? "Adding..." : "Add Reminder"}
        onSubmit={onSubmit}
        style="primary"
        isLoading={isSaving}
        isDisabled={!name.trim() || !list}
      />
    </ActionPanel>
  );

  if (isLoadingLists) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading reminder lists..." />
      </Form>
    );
  }

  return (
    <Form header={header} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="name" label="Reminder" value={name} onChange={setName} />
      {lists.length > 0 && (
        <Form.Dropdown name="list" label="List" value={list} onChange={setList}>
          {lists.map((l) => (
            <Form.Dropdown.Item key={l} title={l} value={l} />
          ))}
        </Form.Dropdown>
      )}
      <Form.TextField name="body" label="Notes" value={body} onChange={setBody} />
      <Form.Checkbox name="hasDueDate" label="Set due date" checked={hasDueDate} onChange={setHasDueDate} variant="switch" />
      {hasDueDate && (
        <Form.DatePicker
          name="dueDate"
          label="Due"
          value={dueDate ?? new Date()}
          onChange={setDueDate}
          type="datetime"
        />
      )}
    </Form>
  );
}

const AddReminderWidget = defineWidget({
  name: "add-reminder",
  description: "Add a reminder to Apple Reminders with optional notes, list, and due date.",
  schema,
  component: AddReminder,
});

export default AddReminderWidget;
