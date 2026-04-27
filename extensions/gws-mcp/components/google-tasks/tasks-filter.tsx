import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
  useLogger,
} from "@eney/api";
import { execGws, tasksToken } from "../../helpers/gws.js";

const schema = z.object({
  tasklistId: z.string().optional().describe("ID of the task list to filter."),
  filter: z
    .enum(["overdue", "today", "week", "custom"])
    .optional()
    .describe("Preset filter: overdue, today, week, or custom date range."),
});

type Props = z.infer<typeof schema>;
type FilterPreset = "overdue" | "today" | "week" | "custom";

interface TaskList {
  id: string;
  title: string;
}

interface Task {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: string;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function deadlineLabel(due: string | undefined): string {
  if (!due) return "No deadline";
  const now = new Date();
  const dueDate = new Date(due);
  const today = startOfDay(now);
  const dueDay = startOfDay(dueDate);
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

function getPresetRange(preset: FilterPreset): { dueMin?: string; dueMax?: string } {
  const now = new Date();
  if (preset === "overdue") {
    return { dueMax: startOfDay(now).toISOString() };
  }
  if (preset === "today") {
    return {
      dueMin: startOfDay(now).toISOString(),
      dueMax: endOfDay(now).toISOString(),
    };
  }
  if (preset === "week") {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return {
      dueMin: startOfDay(now).toISOString(),
      dueMax: endOfDay(weekEnd).toISOString(),
    };
  }
  return {};
}

function TasksFilter(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();

  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [listsError, setListsError] = useState("");
  const [selectedListId, setSelectedListId] = useState(props.tasklistId ?? "");

  const [preset, setPreset] = useState<FilterPreset>(props.filter ?? "today");
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo, setCustomTo] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLists() {
      try {
        const stdout = await execGws(["tasks", "tasklists", "list"], tasksToken());
        const data = JSON.parse(stdout) as { items?: TaskList[] };
        setTaskLists(data.items ?? []);
      } catch (e) {
        setListsError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoadingLists(false);
      }
    }
    void loadLists();
  }, []);

  async function onFilter() {
    if (!selectedListId) return;
    setIsLoadingTasks(true);
    setError("");
    try {
      const range = preset === "custom"
        ? { dueMin: startOfDay(customFrom).toISOString(), dueMax: endOfDay(customTo).toISOString() }
        : getPresetRange(preset);

      const params: Record<string, unknown> = {
        tasklist: selectedListId,
        showCompleted: false,
        showHidden: false,
        ...range,
      };

      logger.info(`[tasks-filter] filter=${preset} params=${JSON.stringify(params)}`);
      const stdout = await execGws(
        ["tasks", "tasks", "list", "--params", JSON.stringify(params)],
        tasksToken()
      );
      const data = JSON.parse(stdout) as { items?: Task[] };
      const fetched = data.items ?? [];
      setTasks(fetched);
      const label = rangeLabel();
      if (fetched.length === 0) {
        closeWidget(`No tasks found for: ${label}`);
        return;
      }
      const lines = fetched.map((t) => {
        const title = (t.title ?? t.id).trim();
        const deadline = deadlineLabel(t.due);
        const dueStr = t.due ? ` (${formatDate(t.due)})` : "";
        return `- ${title}: ${deadline}${dueStr}${t.notes ? ` — ${t.notes.trim()}` : ""}`;
      });
      closeWidget(`${fetched.length} task${fetched.length !== 1 ? "s" : ""} found (${label}):\n${lines.join("\n")}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[tasks-filter] error=${msg}`);
      setError(msg);
      setIsLoadingTasks(false);
    }
  }

  function rangeLabel(): string {
    if (preset === "overdue") return "Overdue";
    if (preset === "today") return "Due Today";
    if (preset === "week") return "Due This Week";
    return `${formatDate(customFrom.toISOString())} – ${formatDate(customTo.toISOString())}`;
  }


  const header = (
    <CardHeader title="Filter Tasks by Deadline" iconBundleId="com.google.drivefs" />
  );

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action
            title={isLoadingTasks ? "Filtering…" : "Filter"}
            onAction={onFilter}
            style="primary"
            isLoading={isLoadingTasks}
            isDisabled={!selectedListId || isLoadingTasks}
          />
        </ActionPanel>
      }
    >
      {listsError && <Paper markdown={`**Error loading lists:** ${listsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}

      <Form.Dropdown
        name="tasklistId"
        label="Task List"
        value={selectedListId}
        onChange={setSelectedListId}
      >
        {isLoadingLists
          ? [<Form.Dropdown.Item key="loading" title="Loading lists…" value="" />]
          : taskLists.map((l) => (
              <Form.Dropdown.Item key={l.id} title={l.title} value={l.id} />
            ))}
      </Form.Dropdown>

      <Form.Dropdown
        name="filter"
        label="Filter"
        value={preset}
        onChange={(v) => setPreset(v as FilterPreset)}
      >
        <Form.Dropdown.Item value="overdue" title="Overdue" />
        <Form.Dropdown.Item value="today" title="Due Today" />
        <Form.Dropdown.Item value="week" title="Due This Week" />
        <Form.Dropdown.Item value="custom" title="Custom Date Range" />
      </Form.Dropdown>

      {preset === "custom" && (
        <>
          <Form.DatePicker
            name="customFrom"
            label="From"
            value={customFrom}
            onChange={setCustomFrom}
            type="date"
          />
          <Form.DatePicker
            name="customTo"
            label="To"
            value={customTo}
            onChange={setCustomTo}
            type="date"
          />
        </>
      )}

    </Form>
  );
}

const TasksFilterWidget = defineWidget({
  name: "tasks-filter",
  description: "Filter Google Tasks by deadline: overdue, due today, due this week, or a custom date range",
  schema,
  component: TasksFilter,
});

export default TasksFilterWidget;
