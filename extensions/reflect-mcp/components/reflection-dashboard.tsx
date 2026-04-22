import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  applyItem,
  cleanupResolved,
  getState,
  getPendingItems,
  rejectItem,
  type ReflectionItem,
  type ReflectionState,
} from "../helpers/storage.js";

const schema = z.object({});
type Props = z.infer<typeof schema>;

// ─── Step list renderer ───────────────────────────────────────────────────────

function stepsMarkdown(steps: ReflectionState["steps"]): string {
  if (steps.length === 0) return "_Starting analysis…_";
  return steps
    .map((s) => {
      const icon = s.status === "done" ? "✓" : s.status === "error" ? "✗" : "⋯";
      return `- ${icon} ${s.description}`;
    })
    .join("\n");
}

// ─── Item detail renderer ─────────────────────────────────────────────────────

function itemMarkdown(item: ReflectionItem, index: number, total: number): string {
  const score = item.critic_score ?? item.actor_score;
  const filled = Math.round(score);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const evidenceBlock =
    item.evidence.length > 0
      ? "\n\n**Evidence:**\n" + item.evidence.map((e) => `> ${e}`).join("\n\n")
      : "";
  const criticNote = item.critic_reasoning
    ? `\n\n_Critic: ${item.critic_reasoning}_`
    : "";
  const scope = item.is_internal ? "internal · agent-adaptation" : "user-visible";

  return (
    `## ${item.title}\n` +
    `*Item ${index + 1} of ${total} · ${item.type} · ${scope}*\n\n` +
    `**Score:** ${bar} ${score}/10\n\n` +
    item.content +
    evidenceBlock +
    criticNote
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function ReflectionDashboard(_props: Props) {
  const closeWidget = useCloseWidget();

  const [state, setState] = useState<ReflectionState>({ status: "idle", steps: [] });
  const [pending, setPending] = useState<ReflectionItem[]>([]);
  // Index of the item currently being reviewed
  const [reviewIndex, setReviewIndex] = useState(0);

  const refresh = useCallback(() => {
    setState(getState());
    setPending(getPendingItems().filter((i) => i.status === "pending"));
  }, []);

  // Poll while running; single load otherwise
  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [state.status, refresh]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function onApprove() {
    const item = pending[reviewIndex];
    if (!item) return;
    applyItem(item.id);
    cleanupResolved();
    refresh();
    // Stay at same index (next item slides in), or clamp
    setReviewIndex((i) => Math.min(i, pending.length - 2));
  }

  function onReject() {
    const item = pending[reviewIndex];
    if (!item) return;
    rejectItem(item.id);
    cleanupResolved();
    refresh();
    setReviewIndex((i) => Math.min(i, pending.length - 2));
  }

  function onApproveAll() {
    pending.forEach((item) => applyItem(item.id));
    cleanupResolved();
    refresh();
    setReviewIndex(0);
  }

  function onRejectAll() {
    pending.forEach((item) => rejectItem(item.id));
    cleanupResolved();
    refresh();
    setReviewIndex(0);
  }

  function onNext() {
    setReviewIndex((i) => Math.min(i + 1, pending.length - 1));
  }

  function onPrev() {
    setReviewIndex((i) => Math.max(i - 1, 0));
  }

  function onDone() {
    closeWidget("Reflection review complete.");
  }

  // ── Views ────────────────────────────────────────────────────────────────

  // Running: show live step list
  if (state.status === "running") {
    const md = `## Reflection Running\n\n${stepsMarkdown(state.steps)}`;
    const actions = (
      <ActionPanel layout="row">
        <Action title="Refresh" onAction={refresh} style="secondary" />
      </ActionPanel>
    );
    return (
      <Form actions={actions}>
        <Paper markdown={md} />
      </Form>
    );
  }

  // Complete: review items one-by-one
  if (state.status === "complete" && pending.length > 0) {
    const safeIndex = Math.max(0, Math.min(reviewIndex, pending.length - 1));
    const item = pending[safeIndex];

    const actions = (
      <ActionPanel layout="column">
        <ActionPanel layout="row">
          {safeIndex > 0 && (
            <Action title="← Prev" onAction={onPrev} style="secondary" />
          )}
          <Action title="Reject" onAction={onReject} style="secondary" />
          <Action title="Approve" onAction={onApprove} style="primary" />
          {safeIndex < pending.length - 1 && (
            <Action title="Next →" onAction={onNext} style="secondary" />
          )}
        </ActionPanel>
        <ActionPanel layout="row">
          <Action title="Approve All" onAction={onApproveAll} style="secondary" />
          <Action title="Reject All" onAction={onRejectAll} style="secondary" />
        </ActionPanel>
      </ActionPanel>
    );

    return (
      <Form actions={actions}>
        <Paper markdown={itemMarkdown(item, safeIndex, pending.length)} />
      </Form>
    );
  }

  // All reviewed or idle
  const isAllDone = state.status === "complete" && pending.length === 0;
  const summaryLine = state.summary ? `\n\n> ${state.summary}` : "";
  const md = isAllDone
    ? `## All Done ✓\n\nAll reflection items reviewed and resolved.${summaryLine}\n\nPersistent files updated:\n- \`reflections/internal.md\`\n- \`reflections/user-facing.md\`\n- \`reflections/skill-requests.md\``
    : `## Reflection Dashboard\n\nNo active session.\n\nCall \`reflection_start\` to begin analysis, then open this widget to review results.`;

  const actions = (
    <ActionPanel layout="row">
      <Action title="Refresh" onAction={refresh} style="secondary" />
      <Action title="Close" onAction={onDone} style="primary" />
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      <Paper markdown={md} />
    </Form>
  );
}

const ReflectionDashboardWidget = defineWidget({
  name: "reflection-dashboard",
  description: "Review and resolve reflection insights discovered from conversation analysis",
  schema,
  component: ReflectionDashboard,
});

export default ReflectionDashboardWidget;
