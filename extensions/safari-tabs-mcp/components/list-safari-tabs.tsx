import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { SafariTab, listOpenTabs } from "../helpers/safari.js";

const schema = z.object({});

type Props = z.infer<typeof schema>;

function groupByWindow(tabs: SafariTab[]): Map<number, SafariTab[]> {
  const map = new Map<number, SafariTab[]>();
  for (const tab of tabs) {
    const list = map.get(tab.windowIndex) ?? [];
    list.push(tab);
    map.set(tab.windowIndex, list);
  }
  return map;
}

function ListSafariTabs(_props: Props) {
  const closeWidget = useCloseWidget();
  const [tabs, setTabs] = useState<SafariTab[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      setTabs(await listOpenTabs());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onDone() {
    closeWidget(`${tabs.length} Safari tab(s) across ${groupByWindow(tabs).size} window(s).`);
  }

  const header = <CardHeader title="Safari Tabs" iconBundleId="com.apple.Safari" />;

  if (isLoading) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Loading tabs..." />
      </Form>
    );
  }

  const grouped = groupByWindow(tabs);
  const lines: string[] = [];
  if (!tabs.length) {
    lines.push("_Safari is not running, or no tabs are open._");
  } else {
    const windowKeys = [...grouped.keys()].sort((a, b) => a - b);
    for (const winIdx of windowKeys) {
      const winTabs = grouped.get(winIdx) ?? [];
      lines.push(`### Window ${winIdx} — ${winTabs.length} tab${winTabs.length === 1 ? "" : "s"}`);
      for (const tab of winTabs) {
        const marker = tab.isCurrent ? " ◀︎ _current_" : "";
        const title = tab.title || "_(untitled)_";
        if (tab.url) {
          lines.push(`- [${title}](${tab.url})${marker}`);
        } else {
          lines.push(`- ${title}${marker}`);
        }
      }
      lines.push("");
    }
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={load} style="secondary" />
          {tabs.length > 0 && (
            <Action.CopyToClipboard
              title="Copy URLs"
              content={tabs.map((t) => t.url).filter(Boolean).join("\n")}
            />
          )}
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const ListSafariTabsWidget = defineWidget({
  name: "list-safari-tabs",
  description: "List all open tabs across Safari windows, with the current tab marked per window.",
  schema,
  component: ListSafariTabs,
});

export default ListSafariTabsWidget;
