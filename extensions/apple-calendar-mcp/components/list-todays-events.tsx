import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { CalendarEvent, listCalendars, listTodaysEvents } from "../helpers/calendar.js";

const schema = z.object({
  calendar: z.string().optional().describe("The calendar name. Defaults to the first available calendar."),
});

type Props = z.infer<typeof schema>;

function ListTodaysEvents(props: Props) {
  const closeWidget = useCloseWidget();
  const [calendar, setCalendar] = useState(props.calendar ?? "");
  const [calendars, setCalendars] = useState<string[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
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

  useEffect(() => {
    if (!calendar) return;
    setIsLoadingEvents(true);
    setError("");
    listTodaysEvents(calendar)
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingEvents(false));
  }, [calendar]);

  function onDone() {
    closeWidget(`${events.length} event(s) today in "${calendar}".`);
  }

  const header = <CardHeader title="Today's Events" iconBundleId="com.apple.iCal" />;
  const actions = (
    <ActionPanel>
      <Action title="Done" onAction={onDone} style="primary" />
    </ActionPanel>
  );

  if (isLoadingCalendars) {
    return (
      <Form header={header} actions={actions}>
        <Paper markdown="Loading calendars..." />
      </Form>
    );
  }

  const sorted = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const lines: string[] = [];
  if (isLoadingEvents) {
    lines.push("Loading events...");
  } else if (!sorted.length) {
    lines.push(`_No events today in "${calendar}"._`);
  } else {
    for (const e of sorted) {
      lines.push(`- **${e.summary}** — ${e.startDate} → ${e.endDate}`);
      if (e.location) lines.push(`  📍 ${e.location}`);
    }
  }

  return (
    <Form header={header} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {calendars.length > 0 && (
        <Form.Dropdown name="calendar" label="Calendar" value={calendar} onChange={setCalendar}>
          {calendars.map((c) => (
            <Form.Dropdown.Item key={c} title={c} value={c} />
          ))}
        </Form.Dropdown>
      )}
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ListTodaysEventsWidget = defineWidget({
  name: "list-todays-events",
  description: "List today's events from a Calendar.app calendar.",
  schema,
  component: ListTodaysEvents,
});

export default ListTodaysEventsWidget;
