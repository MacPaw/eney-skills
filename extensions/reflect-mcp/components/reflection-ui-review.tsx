import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  applyItem,
  cleanupResolved,
  getPendingItems,
  rejectItem,
  type ReflectionItem,
} from "../helpers/storage.js";

const schema = z.object({});
type Props = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  preference: "Preference",
  communication_style: "Communication",
  habit: "Habit",
  skill_request: "Skill Request",
  memory: "Memory",
};

function scoreBar(score: number): string {
  const filled = Math.round(score);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${score}/10`;
}

function statusIcon(status: ReflectionItem["status"]): string {
  if (status === "approved") return "✓ ";
  if (status === "rejected") return "✗ ";
  return "";
}

function ReflectionUIReview(_props: Props) {
  const closeWidget = useCloseWidget();
  // allItems is the stable list — never shrinks, navigation indexes into it
  const [allItems, setAllItems] = useState<ReflectionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const items = getPendingItems();
    setAllItems(items);
    // Start on first pending item
    const firstPending = items.findIndex((i) => i.status === "pending");
    setCurrentIndex(firstPending >= 0 ? firstPending : 0);
  }, []);

  const currentItem = allItems[currentIndex];
  const pendingCount = allItems.filter((i) => i.status === "pending").length;
  const approvedCount = allItems.filter((i) => i.status === "approved").length;

  function doAction(action: "approve" | "reject") {
    if (!currentItem || currentItem.status !== "pending") return;

    if (action === "approve") applyItem(currentItem.id);
    else rejectItem(currentItem.id);

    const fresh = getPendingItems();
    setAllItems(fresh);

    // Auto-advance to next pending item after currentIndex
    const nextPending = fresh.findIndex((i, idx) => idx > currentIndex && i.status === "pending");
    if (nextPending >= 0) {
      setCurrentIndex(nextPending);
    } else if (currentIndex < fresh.length - 1) {
      // No more pending after current — move to next item anyway
      setCurrentIndex(currentIndex + 1);
    }
  }

  function onPrev() {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function onNext() {
    if (currentIndex < allItems.length - 1) setCurrentIndex(currentIndex + 1);
  }

  function onDone() {
    cleanupResolved();
    closeWidget(`Saved ${approvedCount} items.`);
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (allItems.length === 0) {
    return (
      <Form actions={<ActionPanel layout="row"><Action title="Done" onAction={() => closeWidget("No items.")} style="primary" /></ActionPanel>}>
        <Paper markdown="_No pending items. Run `reflection_start` to discover new patterns._" />
      </Form>
    );
  }

  // ── All reviewed — show summary ──────────────────────────────────────────

  if (pendingCount === 0) {
    const md = `## Review Complete

**${approvedCount}** of **${allItems.length}** items approved and saved.

Reflections are stored and ready to use.`;

    return (
      <Form actions={<ActionPanel layout="row"><Action title="Save and Proceed" onAction={onDone} style="primary" /></ActionPanel>}>
        <Paper markdown={md} />
      </Form>
    );
  }

  // ── Item view ────────────────────────────────────────────────────────────

  if (!currentItem) return null;

  const isPending = currentItem.status === "pending";
  const scope = currentItem.is_internal ? "⚙ Internal" : "👤 User-Facing";
  const counter = `${currentIndex + 1}/${allItems.length}`;
  const statusLabel = isPending ? "" : currentItem.status === "approved" ? "  ✓ Approved" : "  ✗ Rejected";

  const detailMd = `## ${statusIcon(currentItem.status)}${counter} · ${currentItem.title}${statusLabel}

${TYPE_LABELS[currentItem.type] ?? currentItem.type} · ${scope}
${scoreBar(currentItem.score)}

${currentItem.content}`;

  const actions = (
    <ActionPanel layout="column">
      <ActionPanel layout="row">
        <Action title="← Prev" onAction={onPrev} style="secondary" isDisabled={currentIndex === 0} />
        <Action title="Reject" onAction={() => doAction("reject")} style="secondary" isDisabled={!isPending} />
        <Action title="Approve" onAction={() => doAction("approve")} style={isPending ? "primary" : "secondary"} isDisabled={!isPending} />
        <Action title="Next →" onAction={onNext} style="secondary" isDisabled={currentIndex === allItems.length - 1} />
      </ActionPanel>
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      <Paper markdown={detailMd} />
    </Form>
  );
}

const ReflectionUIReviewWidget = defineWidget({
  name: "reflection-ui-review",
  description: "Review and approve/reject pending reflections. Navigate all items freely — auto-advances to next pending after each decision.",
  schema,
  component: ReflectionUIReview,
});

export default ReflectionUIReviewWidget;
