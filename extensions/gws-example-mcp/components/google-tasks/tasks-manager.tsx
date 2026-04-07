import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Divider,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
  useLogger,
} from "@eney/api";
import { execGws, tasksToken } from "../../helpers/gws.js";

const schema = z.object({
  tasklistId: z.string().optional().describe("ID of the task list to open."),
  taskId: z.string().optional().describe("ID of the task to pre-select."),
});

type Props = z.infer<typeof schema>;
type Step = "select" | "edit" | "confirm-delete";

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

function TasksManager(props: Props) {
  const closeWidget = useCloseWidget();
  const logger = useLogger();

  // Task lists
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [listsError, setListsError] = useState("");
  const [selectedListId, setSelectedListId] = useState(props.tasklistId ?? "");

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(props.taskId ?? "");

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDue, setEditDue] = useState<Date>(new Date());

  // UI state
  const [step, setStep] = useState<Step>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Load task lists on mount
  useEffect(() => {
    async function loadLists() {
      try {
        const stdout = await execGws("tasks tasklists list", tasksToken(), logger);
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

  // Load tasks when list selected on mount (if pre-selected)
  useEffect(() => {
    if (props.tasklistId) void loadTasks(props.tasklistId);
  }, []);

  async function loadTasks(listId: string) {
    if (!listId) return;
    setIsLoadingTasks(true);
    setTasks([]);
    setSelectedTaskId("");
    setError("");
    setInfo("");
    try {
      const params = { tasklist: listId, showCompleted: false, showHidden: false };
      const stdout = await execGws(
        `tasks tasks list --params '${JSON.stringify(params)}'`,
        tasksToken(),
        logger
      );
      const data = JSON.parse(stdout) as { items?: Task[] };
      setTasks(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingTasks(false);
    }
  }

  function onListChange(id: string) {
    setSelectedListId(id);
    void loadTasks(id);
  }

  function goToEdit() {
    if (!selectedTask) return;
    setEditTitle(selectedTask.title ?? "");
    setEditNotes(selectedTask.notes ?? "");
    setEditDue(selectedTask.due ? new Date(selectedTask.due) : new Date());
    setError("");
    setStep("edit");
  }

  async function onMarkComplete() {
    if (!selectedTaskId || !selectedListId) return;
    setIsLoading(true);
    setError("");
    setInfo("");
    try {
      logger.info(`[tasks] mark-complete taskId=${selectedTaskId}`);
      const params = { tasklist: selectedListId, task: selectedTaskId };
      await execGws(
        `tasks tasks patch --params '${JSON.stringify(params)}' --json '${JSON.stringify({ status: "completed" })}'`,
        tasksToken(),
        logger
      );
      setInfo(`"${selectedTask?.title ?? selectedTaskId}" marked as complete.`);
      await loadTasks(selectedListId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[tasks] mark-complete error=${msg}`);
      setError(msg);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function onSaveEdit() {
    if (!selectedTaskId || !selectedListId) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[tasks] update taskId=${selectedTaskId}`);
      const params = { tasklist: selectedListId, task: selectedTaskId };
      const body: Record<string, string> = { title: editTitle };
      if (editNotes) body.notes = editNotes;
      body.due = editDue.toISOString();
      await execGws(
        `tasks tasks patch --params '${JSON.stringify(params)}' --json '${JSON.stringify(body)}'`,
        tasksToken(),
        logger
      );
      setInfo(`"${editTitle}" updated.`);
      setStep("select");
      await loadTasks(selectedListId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[tasks] update error=${msg}`);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function onDelete() {
    if (!selectedTaskId || !selectedListId) return;
    setIsLoading(true);
    setError("");
    try {
      logger.info(`[tasks] delete taskId=${selectedTaskId}`);
      const params = { tasklist: selectedListId, task: selectedTaskId };
      await execGws(
        `tasks tasks delete --params '${JSON.stringify(params)}' -o /dev/null`,
        tasksToken(),
        logger
      );
      setInfo(`"${selectedTask?.title ?? selectedTaskId}" deleted.`);
      setStep("select");
      await loadTasks(selectedListId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[tasks] delete error=${msg}`);
      setError(msg);
      setStep("select");
    } finally {
      setIsLoading(false);
    }
  }

  const header = (
    <CardHeader title="Tasks Manager" iconBundleId="com.google.drivefs" />
  );

  if (step === "edit") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={() => setStep("select")} style="secondary" />
            <Action
              title={isLoading ? "Saving…" : "Save"}
              onAction={onSaveEdit}
              style="primary"
              isLoading={isLoading}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Form.TextField
          name="editTitle"
          label="Title"
          value={editTitle}
          onChange={setEditTitle}
        />
        <Form.TextField
          name="editNotes"
          label="Notes"
          value={editNotes}
          onChange={setEditNotes}
        />
        <Form.DatePicker
          name="editDue"
          label="Due Date"
          value={editDue}
          onChange={setEditDue}
          type="date"
        />
      </Form>
    );
  }

  if (step === "confirm-delete") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={() => setStep("select")} style="secondary" />
            <Action
              title={isLoading ? "Deleting…" : "Delete"}
              onAction={onDelete}
              style="primary"
              isLoading={isLoading}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper
          markdown={`**Delete this task?**\n\n> **${selectedTask?.title ?? selectedTaskId}**\n\nThis action cannot be undone.`}
        />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Divider />
          <ActionPanel layout="row">
            <Action
              title={isLoading ? "Working…" : "Mark Complete"}
              onAction={onMarkComplete}
              style="secondary"
              isLoading={isLoading}
              isDisabled={!selectedTaskId || isLoading}
            />
            <Action
              title="Edit"
              onAction={goToEdit}
              style="secondary"
              isDisabled={!selectedTaskId || isLoading}
            />
            <Action
              title="Delete"
              onAction={() => setStep("confirm-delete")}
              style="primary"
              isDisabled={!selectedTaskId || isLoading}
            />
          </ActionPanel>
        </ActionPanel>
      }
    >
      {listsError && <Paper markdown={`**Error loading lists:** ${listsError}`} />}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {info && <Paper markdown={`${info}`} />}
      <Form.Dropdown
        name="tasklistId"
        label="Task List"
        value={selectedListId}
        onChange={onListChange}
      >
        {isLoadingLists
          ? [<Form.Dropdown.Item key="loading" title="Loading lists…" value="" />]
          : taskLists.map((l) => (
              <Form.Dropdown.Item key={l.id} title={l.title} value={l.id} />
            ))}
      </Form.Dropdown>
      <Form.Dropdown
        name="taskId"
        label="Task"
        value={selectedTaskId}
        onChange={setSelectedTaskId}
      >
        {isLoadingTasks
          ? [<Form.Dropdown.Item key="loading" title="Loading tasks…" value="" />]
          : tasks.length === 0
          ? [<Form.Dropdown.Item key="empty" title={selectedListId ? "No pending tasks" : "Select a list first"} value="" />]
          : tasks.map((t) => (
              <Form.Dropdown.Item key={t.id} title={t.title ?? t.id} value={t.id} />
            ))}
      </Form.Dropdown>
    </Form>
  );
}

const TasksManagerWidget = defineWidget({
  name: "tasks-manager",
  description: "Browse Google Task lists, view tasks, mark complete, edit, and delete",
  schema,
  component: TasksManager,
});

export default TasksManagerWidget;
