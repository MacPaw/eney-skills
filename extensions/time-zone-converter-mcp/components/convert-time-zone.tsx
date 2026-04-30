import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  COMMON_ZONES,
  detectLocalZone,
  formatInZone,
  listAvailableZones,
  wallClockInZoneToUtc,
} from "../helpers/zones.js";

const schema = z.object({
  iso: z.string().optional().describe("Source date/time as an ISO string. Omit to start from now."),
  sourceZone: z.string().optional().describe("Source IANA time zone, e.g. 'America/New_York'. Defaults to local."),
});

type Props = z.infer<typeof schema>;

function defaultDate(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

function ConvertTimeZone(props: Props) {
  const closeWidget = useCloseWidget();
  const localZone = useMemo(() => detectLocalZone(), []);
  const [zones, setZones] = useState<string[]>(() => COMMON_ZONES);
  const [sourceZone, setSourceZone] = useState(props.sourceZone ?? localZone);
  const [moment, setMoment] = useState<Date | null>(() => (props.iso ? new Date(props.iso) : defaultDate()));

  useEffect(() => {
    setZones(listAvailableZones());
  }, []);

  const utcInstant = useMemo(() => {
    if (!moment) return null;
    return wallClockInZoneToUtc(
      moment.getFullYear(),
      moment.getMonth() + 1,
      moment.getDate(),
      moment.getHours(),
      moment.getMinutes(),
      sourceZone,
    );
  }, [moment, sourceZone]);

  function onDone() {
    if (!utcInstant) closeWidget("Nothing to convert.");
    else closeWidget(`Converted: ${utcInstant.toISOString()}`);
  }

  const lines: string[] = [];
  if (utcInstant) {
    lines.push(`### Source — \`${sourceZone}\``);
    lines.push("");
    lines.push(`\`${formatInZone(utcInstant, sourceZone)}\``);
    lines.push("");
    lines.push("### Equivalents");
    lines.push("");
    lines.push("| Time zone | Local |");
    lines.push("|---|---|");
    for (const z of COMMON_ZONES) {
      if (z === sourceZone) continue;
      lines.push(`| \`${z}\` | \`${formatInZone(utcInstant, z)}\` |`);
    }
    lines.push("");
    lines.push(`**ISO 8601 (UTC):** \`${utcInstant.toISOString()}\``);
  }

  return (
    <Form
      header={<CardHeader title="Time Zone Converter" iconBundleId="com.apple.clock" />}
      actions={
        <ActionPanel layout="row">
          {utcInstant && <Action.CopyToClipboard title="Copy ISO" content={utcInstant.toISOString()} />}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.DatePicker
        name="moment"
        label="Date & time"
        value={moment ?? defaultDate()}
        onChange={setMoment}
        type="datetime"
      />
      <Form.Dropdown name="sourceZone" label="Source zone" value={sourceZone} onChange={setSourceZone} searchable>
        {zones.map((z) => (
          <Form.Dropdown.Item key={z} title={z} value={z} />
        ))}
      </Form.Dropdown>
      {utcInstant && <Paper markdown={lines.join("\n")} />}
    </Form>
  );
}

const ConvertTimeZoneWidget = defineWidget({
  name: "convert-time-zone",
  description:
    "Convert a wall-clock date/time in one IANA time zone to its equivalent in several common zones (UTC, NY, LA, London, Tokyo, etc.). Source zone dropdown is populated from the runtime's full IANA list when available.",
  schema,
  component: ConvertTimeZone,
});

export default ConvertTimeZoneWidget;
