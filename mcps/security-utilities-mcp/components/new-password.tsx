import { useState, useEffect } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  defineWidget,
  useCloseWidget,
  useLogger,
} from "@macpaw/eney-api";
import { generatePassword } from "./generate-password.js";

const schema = z.object({
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

type Props = z.infer<typeof schema>;

function NewPassword(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();
  const [length, setLength] = useState<number | null>(props.length ?? 20);
  const [symbols, setSymbols] = useState(props.symbols ?? true);
  const [numbers, setNumbers] = useState(props.numbers ?? true);
  const [password, setPassword] = useState("");

  function onChangeSymbols(value: boolean) {
    setSymbols(value);
  }

  function onChangeNumber(value: boolean) {
    setNumbers(value);
  }

  function onChangeLength(value: number | null) {
    setLength(value);
  }

  function onPasswordChange(value: string) {
    setPassword(value);
  }

  function onSubmit() {
    const value = generatePassword({ length, symbols, numbers });
    setPassword(value);
  }

  function onDone() {
    closeWidget(`Generated password: ${password}`);
  }

  useEffect(() => {
    const value = generatePassword({ length, symbols, numbers });

    logger.debug("Generated password: %s on mount or options change", value, {
      length,
      symbols,
      numbers,
    });

    setPassword(value);
  }, [length, symbols, numbers]);

  const actions = (
    <ActionPanel layout="row">
      <Action.SubmitForm
        title="Generate"
        onSubmit={onSubmit}
        style="secondary"
      />
      <Action.SubmitForm onSubmit={onDone} title="Done" style="primary" />
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      <Form.NumberField
        name="length"
        label="Password length (max 128)"
        max={128}
        value={length}
        onChange={onChangeLength}
      />
      <Form.Checkbox
        name="symbols"
        label="Include special characters"
        onChange={onChangeSymbols}
        variant="switch"
        checked={symbols}
      />
      <Form.Checkbox
        name="numbers"
        label="Include numbers"
        onChange={onChangeNumber}
        variant="switch"
        checked={numbers}
      />
      <Form.TextField
        name="password"
        value={password}
        onChange={onPasswordChange}
        isCopyable
      />
    </Form>
  );
}

const NewPasswordWidget = defineWidget({
  name: "new-password",
  description: "Generate a new password",
  schema,
  component: NewPassword,
});

export default NewPasswordWidget;
