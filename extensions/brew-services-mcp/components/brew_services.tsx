import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { listServices, controlService, type BrewService, type Action as BrewAction, type ServiceState } from "../helpers/brew.js";

const schema = z.object({
  filter: z.string().optional().describe("Optional substring filter on service name."),
  hideStopped: z.boolean().optional().describe("If true, hide services that are stopped/none. Defaults to false."),
});

type Props = z.infer<typeof schema>;

const STATE_EMOJI: Record<ServiceState, string> = {
  started: "🟢",
  stopped: "⚪",
  scheduled: "🟡",
  error: "🔴",
  none: "⚫",
  unknown: "❓",
};

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  services: BrewService[];
  flash: string;
  selectedName: string;
}

function buildMarkdown(state: State, filter: string, hideStopped: boolean): string {
  if (state.status === "loading") return "_Listing brew services…_";
  if (state.status === "error") return `**Error:** ${state.errorMsg}`;
  let svc = state.services;
  if (filter.trim()) {
    const q = filter.trim().toLowerCase();
    svc = svc.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (hideStopped) {
    svc = svc.filter((s) => s.state !== "stopped" && s.state !== "none");
  }
  const lines: string[] = [];
  lines.push(`### ${svc.length} service${svc.length === 1 ? "" : "s"}`);
  if (state.flash) {
    lines.push("");
    lines.push(`> ${state.flash}`);
  }
  if (state.selectedName) {
    lines.push("");
    lines.push(`Selected: **${state.selectedName}**`);
  }
  lines.push("");
  if (svc.length === 0) {
    lines.push("_No matching services._");
    return lines.join("\n");
  }
  lines.push("| Name | State | User |");
  lines.push("|---|---|---|");
  for (const s of svc) {
    const star = s.name === state.selectedName ? "⭐ " : "";
    lines.push(`| ${star}${s.name} | ${STATE_EMOJI[s.state]} ${s.state} | ${s.user || "—"} |`);
  }
  return lines.join("\n");
}

function BrewServices(props: Props) {
  const closeWidget = useCloseWidget();
  const [filter, setFilter] = useState(props.filter ?? "");
  const [hideStopped, setHideStopped] = useState<boolean>(props.hideStopped ?? false);
  const [selectedName, setSelectedName] = useState("");
  const [state, setState] = useState<State>({
    status: "loading",
    errorMsg: "",
    services: [],
    flash: "",
    selectedName: "",
  });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    listServices()
      .then((svc) => {
        if (cancelled) return;
        setState((s) => ({
          status: "done",
          errorMsg: "",
          services: svc,
          flash: s.flash,
          selectedName: s.selectedName,
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          services: [],
          flash: "",
          selectedName: "",
        });
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function refresh() {
    setReloadCount((c) => c + 1);
  }

  function onToggleHide() {
    setHideStopped((v) => !v);
  }

  async function runAction(action: BrewAction) {
    if (!selectedName.trim()) {
      setState((s) => ({ ...s, flash: "⚠️ Type a service name first (or click ⭐ on a row)." }));
      return;
    }
    try {
      const out = await controlService(selectedName.trim(), action);
      setState((s) => ({
        ...s,
        flash: `✅ brew services ${action} ${selectedName}: ${out || "ok"}`,
      }));
      setReloadCount((c) => c + 1);
    } catch (err) {
      setState((s) => ({
        ...s,
        flash: `❌ ${err instanceof Error ? err.message : String(err)}`,
      }));
    }
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    const visible = state.services.filter((s) => {
      if (hideStopped && (s.state === "stopped" || s.state === "none")) return false;
      if (filter.trim() && !s.name.toLowerCase().includes(filter.trim().toLowerCase())) return false;
      return true;
    });
    if (visible.length === 0) {
      closeWidget("No brew services to report.");
      return;
    }
    closeWidget(
      `Brew services (${visible.length}):\n` +
      visible.map((s) => `- ${s.name}: ${s.state} (${s.user || "system"})`).join("\n"),
    );
  }

  const visibleState: State = { ...state, selectedName };

  return (
    <Form
      header={<CardHeader title="Brew Services" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={refresh} style="primary" />
          <Action title="Start" onAction={() => runAction("start")} style="secondary" />
          <Action title="Stop" onAction={() => runAction("stop")} style="secondary" />
          <Action title="Restart" onAction={() => runAction("restart")} style="secondary" />
          <Action title="Run (one-shot)" onAction={() => runAction("run")} style="secondary" />
          <Action
            title={hideStopped ? "Show all" : "Hide stopped"}
            onAction={onToggleHide}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(visibleState, filter, hideStopped)} />
      <Form.TextField name="filter" label="Filter (substring)" value={filter} onChange={setFilter} />
      <Form.TextField
        name="selected"
        label="Service to control (e.g. postgresql@16)"
        value={selectedName}
        onChange={setSelectedName}
      />
    </Form>
  );
}

const BrewServicesWidget = defineWidget({
  name: "brew_services",
  description:
    "List Homebrew services and start / stop / restart / run them. Wraps `brew services list` and `brew services <action> <name>`. Service names are validated against [a-zA-Z0-9._@+-] before being passed to the shell.",
  schema,
  component: BrewServices,
});

export default BrewServicesWidget;
