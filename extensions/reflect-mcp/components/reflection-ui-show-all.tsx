import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  getLearnedItems,
  resetAllReflections,
  type ItemType,
  type ReflectionItem,
} from "../helpers/storage.js";

const schema = z.object({});
type Props = z.infer<typeof schema>;

type Page = "internal" | "user-facing" | "skill-requests";

const PAGES: Page[] = ["internal", "user-facing", "skill-requests"];
const PAGE_TITLES: Record<Page, string> = {
  "internal": "Internal Rules",
  "user-facing": "Proactive Opportunities",
  "skill-requests": "Skill Requests",
};

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

function pageItems(learned: ReflectionItem[], page: Page): ReflectionItem[] {
  if (page === "skill-requests") return learned.filter((i) => i.type === "skill_request");
  if (page === "internal") return learned.filter((i) => i.type !== "skill_request" && i.is_internal);
  return learned.filter((i) => i.type !== "skill_request" && !i.is_internal);
}

function renderItems(items: ReflectionItem[]): string {
  if (items.length === 0) return "_No entries yet. Run `reflection_start` to discover patterns._";
  return items.map((item, i) =>
    `### ${i + 1}. ${item.title}\n`
    + `*${TYPE_LABELS[item.type] ?? item.type} · ${scoreBar(item.score)}*\n\n`
    + item.content,
  ).join("\n\n---\n\n");
}

function ReflectionUIShowAll(_props: Props) {
  const closeWidget = useCloseWidget();
  const [pageIndex, setPageIndex] = useState(0);
  const [learned, setLearned] = useState<ReflectionItem[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setLearned(getLearnedItems());
  }, []);

  const currentPage = PAGES[pageIndex];
  const items = pageItems(learned, currentPage);
  const pageCounter = `${pageIndex + 1}/${PAGES.length} · ${PAGE_TITLES[currentPage]} (${items.length})`;
  const contentWithHeader = `# ${pageCounter}\n\n${renderItems(items)}`;

  function onPrev() {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
  }

  function onNext() {
    if (pageIndex < PAGES.length - 1) setPageIndex(pageIndex + 1);
  }

  function onReset() {
    if (!confirmReset) { setConfirmReset(true); return; }
    resetAllReflections();
    setLearned([]);
    setConfirmReset(false);
  }

  const actions = (
    <ActionPanel layout="column">
      <ActionPanel layout="row">
        <Action title="← Prev" onAction={onPrev} style="secondary" isDisabled={pageIndex === 0} />
        <Action title="Next →" onAction={onNext} style="secondary" isDisabled={pageIndex === PAGES.length - 1} />
      </ActionPanel>
      <ActionPanel layout="row">
        <Action title={confirmReset ? "⚠ Confirm Delete All" : "Clear All"} onAction={onReset} style="secondary" />
        <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
      </ActionPanel>
    </ActionPanel>
  );

  return (
    <Form actions={actions}>
      <Paper markdown={contentWithHeader} />
    </Form>
  );
}

const ReflectionUIShowAllWidget = defineWidget({
  name: "reflection-ui-show-all",
  description: "View all learned reflections — approved patterns, rules, and insights. Browse by internal rules, proactive opportunities, and skill requests.",
  schema,
  component: ReflectionUIShowAll,
});

export default ReflectionUIShowAllWidget;
