import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Unit = "c" | "f" | "k";

const schema = z.object({
  value: z.number().optional().describe("The temperature value to convert."),
  fromUnit: z.enum(["c", "f", "k"]).optional().describe("Source unit: 'c' (Celsius), 'f' (Fahrenheit), 'k' (Kelvin). Defaults to 'c'."),
});

type Props = z.infer<typeof schema>;

function toCelsius(value: number, from: Unit): number {
  switch (from) {
    case "c":
      return value;
    case "f":
      return ((value - 32) * 5) / 9;
    case "k":
      return value - 273.15;
  }
}

function fromCelsius(celsius: number, to: Unit): number {
  switch (to) {
    case "c":
      return celsius;
    case "f":
      return (celsius * 9) / 5 + 32;
    case "k":
      return celsius + 273.15;
  }
}

const UNIT_LABELS: Record<Unit, string> = { c: "Celsius (°C)", f: "Fahrenheit (°F)", k: "Kelvin (K)" };
const UNIT_SYMBOL: Record<Unit, string> = { c: "°C", f: "°F", k: "K" };
const ABSOLUTE_ZERO_C = -273.15;

function formatValue(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return Number.parseFloat(n.toFixed(4)).toString();
}

function ConvertTemperature(props: Props) {
  const closeWidget = useCloseWidget();
  const [value, setValue] = useState<number | null>(props.value ?? null);
  const [fromUnit, setFromUnit] = useState<Unit>(props.fromUnit ?? "c");

  const conversions = useMemo(() => {
    if (value === null) return null;
    const celsius = toCelsius(value, fromUnit);
    const belowAbsoluteZero = celsius < ABSOLUTE_ZERO_C - 1e-9;
    return {
      belowAbsoluteZero,
      results: (["c", "f", "k"] as Unit[]).map((u) => ({ unit: u, value: fromCelsius(celsius, u) })),
    };
  }, [value, fromUnit]);

  function onDone() {
    if (!conversions) closeWidget("Nothing converted.");
    else if (conversions.belowAbsoluteZero) closeWidget("Below absolute zero.");
    else {
      const c = conversions.results.find((r) => r.unit === "c")!.value;
      const f = conversions.results.find((r) => r.unit === "f")!.value;
      closeWidget(`${formatValue(c)}°C / ${formatValue(f)}°F`);
    }
  }

  return (
    <Form
      header={<CardHeader title="Temperature Converter" iconBundleId="com.apple.calculator" />}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.NumberField name="value" label="Value" value={value} onChange={setValue} />
      <Form.Dropdown name="fromUnit" label="From" value={fromUnit} onChange={(v) => setFromUnit(v as Unit)}>
        {(Object.keys(UNIT_LABELS) as Unit[]).map((u) => (
          <Form.Dropdown.Item key={u} title={UNIT_LABELS[u]} value={u} />
        ))}
      </Form.Dropdown>
      {conversions?.belowAbsoluteZero && (
        <Paper markdown="**Warning:** That value is below absolute zero (-273.15 °C / 0 K)." />
      )}
      {conversions && (
        <Paper
          markdown={[
            "| Unit | Value |",
            "|---|---|",
            ...conversions.results.map((r) => `| ${UNIT_LABELS[r.unit]} | \`${formatValue(r.value)}${UNIT_SYMBOL[r.unit]}\` |`),
          ].join("\n")}
        />
      )}
    </Form>
  );
}

const ConvertTemperatureWidget = defineWidget({
  name: "convert-temperature",
  description:
    "Convert a temperature between Celsius (°C), Fahrenheit (°F), and Kelvin (K). Pivots through Celsius internally; warns when the input is below absolute zero (-273.15 °C / 0 K).",
  schema,
  component: ConvertTemperature,
});

export default ConvertTemperatureWidget;
