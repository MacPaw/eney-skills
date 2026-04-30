import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  weightKg: z.number().optional().describe("Weight in kilograms (metric)."),
  heightCm: z.number().optional().describe("Height in centimeters (metric)."),
  weightLb: z.number().optional().describe("Weight in pounds (imperial)."),
  heightIn: z.number().optional().describe("Height in inches (imperial)."),
  units: z.enum(["metric", "imperial"]).optional().describe("Preferred units. Defaults to metric."),
});

type Props = z.infer<typeof schema>;
type Units = "metric" | "imperial";

interface BMIResult {
  bmi: number;
  category: string;
  emoji: string;
}

function classify(bmi: number): { category: string; emoji: string } {
  if (bmi < 16) return { category: "Severe thinness", emoji: "🔵" };
  if (bmi < 17) return { category: "Moderate thinness", emoji: "🔵" };
  if (bmi < 18.5) return { category: "Mild thinness", emoji: "🔵" };
  if (bmi < 25) return { category: "Normal range", emoji: "🟢" };
  if (bmi < 30) return { category: "Overweight", emoji: "🟡" };
  if (bmi < 35) return { category: "Obese class I", emoji: "🟠" };
  if (bmi < 40) return { category: "Obese class II", emoji: "🔴" };
  return { category: "Obese class III", emoji: "🔴" };
}

function calcBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const { category, emoji } = classify(bmi);
  return { bmi, category, emoji };
}

function lbToKg(lb: number): number {
  return lb * 0.45359237;
}

function inToCm(inches: number): number {
  return inches * 2.54;
}

function CalculateBMI(props: Props) {
  const closeWidget = useCloseWidget();

  // Initialize from props (with sensible defaults)
  const initialUnits: Units =
    props.units ??
    (props.weightLb !== undefined || props.heightIn !== undefined ? "imperial" : "metric");

  const [units, setUnits] = useState<Units>(initialUnits);
  const [weightKg, setWeightKg] = useState<number>(props.weightKg ?? 70);
  const [heightCm, setHeightCm] = useState<number>(props.heightCm ?? 175);
  const [weightLb, setWeightLb] = useState<number>(props.weightLb ?? 154);
  const [heightIn, setHeightIn] = useState<number>(props.heightIn ?? 69);

  const wKg = units === "metric" ? weightKg : lbToKg(weightLb);
  const hCm = units === "metric" ? heightCm : inToCm(heightIn);

  const result = wKg > 0 && hCm > 0 ? calcBMI(wKg, hCm) : null;

  const idealMin = ((18.5 * (hCm / 100) * (hCm / 100))).toFixed(1);
  const idealMax = ((24.9 * (hCm / 100) * (hCm / 100))).toFixed(1);

  function onDone() {
    if (result) {
      const wDisplay = units === "metric" ? `${weightKg} kg` : `${weightLb} lb`;
      const hDisplay = units === "metric" ? `${heightCm} cm` : `${heightIn} in`;
      closeWidget(
        `BMI: ${result.bmi.toFixed(1)} (${result.category}). Inputs: ${wDisplay}, ${hDisplay}.`,
      );
    } else {
      closeWidget("Closed without computing BMI.");
    }
  }

  function onToggleUnits() {
    setUnits((u) => (u === "metric" ? "imperial" : "metric"));
  }

  const markdown = result
    ? [
        `### ${result.emoji} BMI: **${result.bmi.toFixed(1)}**`,
        ``,
        `**Category:** ${result.category}`,
        ``,
        `_Healthy weight range for your height: **${idealMin}–${idealMax} kg**_`,
        ``,
        `> BMI is a screening tool, not a diagnosis. Athletic builds, age, and other factors can shift its meaning.`,
      ].join("\n")
    : "_Enter weight and height to see your BMI._";

  return (
    <Form
      header={<CardHeader title={`BMI Calculator (${units})`} iconBundleId="com.apple.Health" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title={units === "metric" ? "Switch to Imperial" : "Switch to Metric"}
            onAction={onToggleUnits}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      {units === "metric" ? (
        <>
          <Form.NumberField
            name="weightKg"
            label="Weight (kg)"
            value={weightKg}
            onChange={(v) => setWeightKg(Number(v) || 0)}
          />
          <Form.NumberField
            name="heightCm"
            label="Height (cm)"
            value={heightCm}
            onChange={(v) => setHeightCm(Number(v) || 0)}
          />
        </>
      ) : (
        <>
          <Form.NumberField
            name="weightLb"
            label="Weight (lb)"
            value={weightLb}
            onChange={(v) => setWeightLb(Number(v) || 0)}
          />
          <Form.NumberField
            name="heightIn"
            label="Height (in)"
            value={heightIn}
            onChange={(v) => setHeightIn(Number(v) || 0)}
          />
        </>
      )}
    </Form>
  );
}

const BMIWidget = defineWidget({
  name: "calculate_bmi",
  description:
    "Calculate Body Mass Index (BMI) from weight and height. Supports metric (kg/cm) and imperial (lb/in). Shows category and healthy weight range.",
  schema,
  component: CalculateBMI,
});

export default BMIWidget;
