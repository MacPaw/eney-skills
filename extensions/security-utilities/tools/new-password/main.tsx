import { useState, useEffect } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form } from "@macpaw/eney-api";
import { generatePassword } from "./generate-password.js";

export const props = z.object({
  length: z
    .number()
    .optional()
    .describe("The length of the password to generate."),
  symbols: z
    .boolean()
    .optional()
    .describe("Whether to include special characters in the password."),
  numbers: z
    .boolean()
    .optional()
    .describe("Whether to include numbers in the password."),
});

type Props = z.infer<typeof props>;

export default function Extension(props: Props) {
  const [length, setLength] = useState(props.length ?? 20);
  const [symbols, setSymbols] = useState(props.symbols ?? true);
  const [numbers, setNumbers] = useState(props.numbers ?? true);
  const [password, setPassword] = useState("");

  function onChangeSymbols(value: boolean) {
    setSymbols(value);
  }

  function onChangeNumber(value: boolean) {
    setNumbers(value);
  }

  function onChangeLength(value: number) {
    setLength(value);
  }

  function onPasswordChange(value: string) {
    setPassword(value);
  }

  function onSubmit() {
    const value = generatePassword({ length, symbols, numbers });
    setPassword(value);
  }

  useEffect(() => {
    const value = generatePassword({ length, symbols, numbers });
    setPassword(value);
  }, [length, symbols, numbers]);

  const actions = (
    <ActionPanel>
      <Action.CopyToClipboard content={password} style="primary" />
      <Action.SubmitForm title="Generate" onSubmit={onSubmit} style="primary" />
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      <Form.NumberField
        name="length"
        label="Password length"
        value={length}
        onChange={onChangeLength}
      />
      <Form.Checkbox
        name="symbols"
        label="Include special characters"
        onChange={onChangeSymbols}
        variant="switch"
        checked
      />
      <Form.Checkbox
        name="numbers"
        label="Include numbers"
        onChange={onChangeNumber}
        variant="switch"
        checked
      />
      <Form.TextField
        name="password"
        value={password}
        onChange={onPasswordChange}
      />
    </Form>
  );
}
