import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { checkPwned, sha1Upper } from "../helpers/hibp.js";

const schema = z.object({
  password: z.string().optional().describe("The password to check. Only its SHA-1 prefix (first 5 hex chars) is sent to the HIBP API."),
});

type Props = z.infer<typeof schema>;

interface DisplayState {
  count: number;
  fullHashPreview: string;
}

function CheckPasswordPwned(props: Props) {
  const closeWidget = useCloseWidget();
  const [password, setPassword] = useState(props.password ?? "");
  const [result, setResult] = useState<DisplayState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!password) return;
    setIsChecking(true);
    setError("");
    setResult(null);
    const response = await checkPwned(password);
    if (!response.ok) {
      setError(response.error);
    } else {
      setResult({ count: response.count, fullHashPreview: response.fullHashPreview });
    }
    setIsChecking(false);
  }

  function onDone() {
    if (!result) closeWidget("No check performed.");
    else if (result.count === 0) closeWidget("Not found in HIBP breach data.");
    else closeWidget(`Found in HIBP breach data ${result.count.toLocaleString()} time(s).`);
  }

  const prefix = password ? sha1Upper(password).slice(0, 5) : "";

  return (
    <Form
      header={<CardHeader title="Password Pwned" iconBundleId="com.apple.preference.security" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isChecking ? "Checking..." : "Check"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isChecking}
            isDisabled={!password}
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Form.PasswordField name="password" label="Password" value={password} onChange={setPassword} />
      {prefix && (
        <Paper
          markdown={`_HIBP receives only the first 5 hex chars of the SHA-1 hash: \`${prefix}\`. Your password never leaves this Mac._`}
        />
      )}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {result && result.count === 0 && (
        <Paper
          markdown={[
            "### ✅ Not found",
            "",
            "This password does not appear in HIBP's breach corpus.",
            "",
            `_Hash preview: \`${result.fullHashPreview}\`_`,
          ].join("\n")}
        />
      )}
      {result && result.count > 0 && (
        <Paper
          markdown={[
            "### ⚠️ Pwned",
            "",
            `Seen in **${result.count.toLocaleString()}** breach(es). Stop using it everywhere.`,
            "",
            `_Hash preview: \`${result.fullHashPreview}\`_`,
          ].join("\n")}
        />
      )}
    </Form>
  );
}

const CheckPasswordPwnedWidget = defineWidget({
  name: "check-password-pwned",
  description:
    "Check whether a password has appeared in HaveIBeenPwned's breach corpus using the k-anonymity API. The password is SHA-1 hashed locally and only the first 5 hex chars of the hash are sent — the password itself never leaves the Mac. Returns the breach count.",
  schema,
  component: CheckPasswordPwned,
});

export default CheckPasswordPwnedWidget;
