import { useEffect, useState } from "react";
import { z } from "zod";
import { Paper, defineWidget, useCloseWidget } from "@eney/api";
import { execCommand, type ExecResult } from "../helpers/exec-command.js";

const schema = z.object({
  command: z
    .string()
    .optional()
    .describe("The shell command to execute."),
  workingDirectory: z
    .string()
    .optional()
    .describe(
      "The working directory for the command. Defaults to the user home directory.",
    ),
  timeout: z
    .number()
    .optional()
    .describe("Timeout in seconds. Defaults to 120."),
});

type Props = z.infer<typeof schema>;

function formatResult(result: ExecResult): string {
  const parts: string[] = [];

  if (result.stdout.trim()) {
    parts.push(result.stdout.trim());
  }

  if (result.stderr.trim()) {
    parts.push(`[stderr]\n${result.stderr.trim()}`);
  }

  if (!result.stdout.trim() && !result.stderr.trim()) {
    parts.push("(no output)");
  }

  const duration = (result.durationMs / 1000).toFixed(1);
  parts.push(`\n[exit ${result.exitCode} | ${duration}s | ${result.cwd}]`);

  return parts.join("\n");
}

function RunCommand(props: Props) {
  const closeWidget = useCloseWidget();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!props.command) {
      closeWidget("Error: No command provided.");
      return;
    }

    execCommand(props.command, {
      cwd: props.workingDirectory,
      timeoutMs: props.timeout ? props.timeout * 1000 : undefined,
    }).then((result) => {
      setIsLoading(false);
      closeWidget(formatResult(result));
    });
  }, []);

  if (isLoading) {
    return <Paper markdown={`Running: \`${props.command ?? "(no command)"}\``} />;
  }

  return <Paper markdown="Done." />;
}

const RunCommandWidget = defineWidget({
  name: "run-command",
  description:
    "Execute shell commands on the local machine for system administration, troubleshooting, installing packages, diagnosing issues, managing services, reading logs, and general system tasks. Use this whenever you need to interact with the user's local environment.",
  schema,
  component: RunCommand,
});

export default RunCommandWidget;
