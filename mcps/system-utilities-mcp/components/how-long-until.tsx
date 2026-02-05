import { useState } from "react";
import {
  Action,
  ActionPanel,
  defineWidget,
  Form,
  Paper,
} from "@macpaw/eney-api";
import z from "zod";

export const props = z.object({
  date: z
    .number()
    .optional()
    .describe(
      "The timestamp of the date to calculate the time until. Example: 1734567890",
    ),
});

type Props = z.infer<typeof props>;

function HowLongUntil(props: Props) {
  const [date, setDate] = useState<Date>(new Date(props.date ?? Date.now()));
  const [result, setResult] = useState<string | undefined>(undefined);

  function onTimeChange(value: Date) {
    setDate(value);
  }

  function calculate() {
    const now = new Date();
    const delta = date.getTime() - now.getTime();

    // Check if both dates are on the same day
    const isSameDay = date.toDateString() === now.toDateString();

    if (isSameDay) {
      setResult("The selected date is today!");
      return;
    }

    const days = Math.floor(delta / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (delta % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const minutes = Math.floor((delta % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((delta % (1000 * 60)) / 1000);

    setResult(
      `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`,
    );
  }

  function onSubmit() {
    calculate();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Calculate"
            onSubmit={onSubmit}
            style="secondary"
          />
          <Action.Finalize title="Done" />
        </ActionPanel>
      }
    >
      <Form.DatePicker
        label="Select date"
        name="date"
        type="datetime"
        value={date}
        onChange={onTimeChange}
      />
      {result && <Paper markdown={result} $context={true} />}
    </Form>
  );
}

const HowLongUntilWidget = defineWidget({
  name: "how-long-until",
  description: "Calculate the time remaining until a specified date.",
  schema: props,
  component: HowLongUntil,
});

export default HowLongUntilWidget;
