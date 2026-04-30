import { useMemo, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import zxcvbn from "zxcvbn";

const schema = z.object({
  password: z.string().optional().describe("The password to evaluate. Not stored, not transmitted, evaluated locally."),
});

type Props = z.infer<typeof schema>;

const SCORE_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];

function bar(score: number): string {
  return "█".repeat(score + 1) + "░".repeat(4 - score);
}

function CheckPasswordStrength(props: Props) {
  const closeWidget = useCloseWidget();
  const [password, setPassword] = useState(props.password ?? "");

  const result = useMemo(() => (password ? zxcvbn(password) : null), [password]);

  function onDone() {
    if (!result) closeWidget("No password evaluated.");
    else closeWidget(`Strength: ${SCORE_LABELS[result.score]} (${result.score}/4).`);
  }

  const lines: string[] = [];
  if (result) {
    lines.push(`### ${SCORE_LABELS[result.score]} — ${result.score}/4`);
    lines.push("");
    lines.push(`\`${bar(result.score)}\``);
    lines.push("");
    lines.push("| | |");
    lines.push("|---|---|");
    lines.push(`| **Length** | ${password.length} chars |`);
    lines.push(`| **Guesses** | ${result.guesses.toExponential(1)} |`);
    lines.push(`| **Online (throttled)** | ${result.crack_times_display.online_throttling_100_per_hour} |`);
    lines.push(`| **Online (no throttle)** | ${result.crack_times_display.online_no_throttling_10_per_second} |`);
    lines.push(`| **Offline (slow hash)** | ${result.crack_times_display.offline_slow_hashing_1e4_per_second} |`);
    lines.push(`| **Offline (fast hash)** | ${result.crack_times_display.offline_fast_hashing_1e10_per_second} |`);
    if (result.feedback.warning) {
      lines.push("");
      lines.push(`**Warning:** ${result.feedback.warning}`);
    }
    if (result.feedback.suggestions.length > 0) {
      lines.push("");
      lines.push("**Suggestions:**");
      for (const s of result.feedback.suggestions) lines.push(`- ${s}`);
    }
  } else {
    lines.push("Enter a password to estimate its strength.");
    lines.push("");
    lines.push("_The password is evaluated locally — never stored, never transmitted._");
  }

  return (
    <Form
      header={<CardHeader title="Password Strength" iconBundleId="com.apple.preference.security" />}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Form.PasswordField name="password" label="Password" value={password} onChange={setPassword} />
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const CheckPasswordStrengthWidget = defineWidget({
  name: "check-password-strength",
  description:
    "Estimate the strength of a password using zxcvbn. Reports a 0-4 score, estimated crack times for online/offline attacks, and any warnings or suggestions. Evaluation is fully local — the password is never transmitted off-device.",
  schema,
  component: CheckPasswordStrength,
});

export default CheckPasswordStrengthWidget;
