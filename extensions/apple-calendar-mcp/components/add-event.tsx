import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { addEvent, listCalendars } from "../helpers/calendar.js";

const schema = z.object({
  summary: z.string().optional().describe("The event title."),
  calendar: z.string().optional().describe("The calendar name. Defaults to the first available calendar."),
  startDate: z.string().optional().describe("ISO 8601 start date/time, e.g. 2026-05-01T09:00:00."),
  endDate: z.string().optional().describe("ISO 8601 end date/time. Defaults to one hour after start."),
  location: z.string().optional().describe("Optional location."),
  description: z.string().optional().describe("Optional notes."),
});

type Props = z.infer<typeof schema>;

const HOUR_MS = 60 * 60 * 1000;

function parseProvidedDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function AddEvent(props: Props) {
  const closeWidget = useCloseWidget();
  const initialStart = parseProvidedDate(props.startDate, defaultStart());
  const initialEnd = parseProvidedDate(props.endDate, new Date(initialStart.getTime() + HOUR_MS));

  const [summary, setSummary] = useState(props.summary ?? "");
  const [calendar, setCalendar] = useState(props.calendar ?? "");
  const [startDate, setStartDate] = useState<Date | null>(initialStart);
  const [endDate, setEndDate] = useState<Date | null>(initialEnd);
  const [location, setLocation] = useState(props.location ?? "");
  const [description, setDescription] = useState(props.description ?? "");
  const [calendars, setCalendars] = useState<string[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listCalendars()
      .then((available) => {
        setCalendars(available);
        if (!calendar && available.length) setCalendar(available[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingCalendars(false));
  }, []);

  async function onSubmit() {
    if (!summary.trim() || !calendar || !startDate || !endDate) return;
    if (endDate.getTime() <= startDate.getTime()) {
      setError("End date must be after start date.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await addEvent({
        calendar,
        summary: summary.trim(),
        startDate,
        endDate,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });
      closeWidget(`Added "${summary.trim()}" to "${calendar}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsSaving(false);
    }
  }

  const header = <CardHeader title="Add Event" iconBundleId="com.apple.iCal" />;
  const actions = (
    <ActionPanel>
      <Action.SubmitForm
        title={isSaving ? "Adding..." : "Add Event"}
        onSubmit={onSubmit}
        style="primary"
        isLoading={isSaving}
        isDisabled={!summary.trim() || !calendar || !startDate || !endDate}
      />
    </ActionPanel>
  );

  if (isLoadingCalendars) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading calendars..." />
      </Form>
    );
  }

  return (
    <Form header={header} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="summary" label="Title" value={summary} onChange={setSummary} />
      {calendars.length > 0 && (
        <Form.Dropdown name="calendar" label="Calendar" value={calendar} onChange={setCalendar}>
          {calendars.map((c) => (
            <Form.Dropdown.Item key={c} title={c} value={c} />
          ))}
        </Form.Dropdown>
      )}
      <Form.DatePicker
        name="startDate"
        label="Start"
        value={startDate ?? defaultStart()}
        onChange={setStartDate}
        type="datetime"
      />
      <Form.DatePicker
        name="endDate"
        label="End"
        value={endDate ?? new Date((startDate ?? defaultStart()).getTime() + HOUR_MS)}
        onChange={setEndDate}
        type="datetime"
      />
      <Form.TextField name="location" label="Location" value={location} onChange={setLocation} />
      <Form.TextField name="description" label="Notes" value={description} onChange={setDescription} />
    </Form>
  );
}

const AddEventWidget = defineWidget({
  name: "add-event",
  description: "Add an event to a Calendar.app calendar with optional location and notes.",
  schema,
  component: AddEvent,
});

export default AddEventWidget;
