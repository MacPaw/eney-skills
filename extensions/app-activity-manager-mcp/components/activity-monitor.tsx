import { useEffect, useRef, useState } from "react";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  defineWidget,
} from "@eney/api";
import { execFile } from "node:child_process";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AppProcess {
  pid: number;
  name: string;
  bundlePath: string;
  bundleId: string;
}


// ─── Helpers ───────────────────────────────────────────────────────────────────

function fetchAppList(): Promise<AppProcess[]> {
  return new Promise((resolve, reject) => {
    // Use NSWorkspace via AppleScript Cocoa bridge — catches all regular GUI apps
    const appleScript = `
use framework "AppKit"
use scripting additions
set out to ""
set nsApps to current application's NSWorkspace's sharedWorkspace()'s runningApplications() as list
repeat with nsApp in nsApps
  try
    if (nsApp's activationPolicy() as integer) is in {0, 1} then
      set appName to nsApp's localizedName() as text
      set appPID to nsApp's processIdentifier() as integer
      set bundleURL to nsApp's bundleURL()
      if bundleURL is not missing value then
        set appPath to bundleURL's |path|() as text
        set bundleId to nsApp's bundleIdentifier() as text
        set out to out & appPID & tab & appName & tab & appPath & tab & bundleId & linefeed
      end if
    end if
  end try
end repeat
return out`;

    execFile("/usr/bin/osascript", ["-e", appleScript], (err, stdout, stderr) => {
      if (err) { reject(new Error(stderr || err.message)); return; }

      const lines = stdout.trim().split("\n").filter(Boolean);
      if (lines.length === 0) { resolve([]); return; }

      const result = lines
        .map(l => {
          const parts = l.split("\t");
          if (parts.length < 4) return null;
          const pid = parseInt(parts[0], 10);
          const name = parts[1].trim();
          const bundlePath = parts[2].trim();
          const bundleId = parts[3].trim();
          if (isNaN(pid) || !name || !bundlePath || !bundleId) return null;
          return { pid, name, bundlePath, bundleId };
        })
        .filter((e): e is AppProcess => e !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      resolve(result);
    });
  });
}

function quitApp(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("/bin/kill", ["-9", String(pid)], (err) => {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

function restartApp(pid: number, bundlePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("/bin/kill", ["-TERM", String(pid)], () => {
      setTimeout(() => {
        execFile("/usr/bin/open", [bundlePath], (err) => {
          if (err) { reject(err); return; }
          resolve();
        });
      }, 800);
    });
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

function ActivityMonitor() {
  const [apps, setApps] = useState<AppProcess[]>([]);
  const [search, setSearch] = useState<string>("");
  const [selectedPid, setSelectedPid] = useState<string>("__none__");
  const appsRef = useRef<AppProcess[]>([]);

  useEffect(() => { appsRef.current = apps; }, [apps]);

  // Load once on mount
  useEffect(() => {
    fetchAppList().then(setApps).catch(() => {});
  }, []);

  const filteredApps = search.trim()
    ? apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : apps;

  // Autocomplete: auto-select first match when searching, reset when search cleared
  useEffect(() => {
    if (!search.trim()) { setSelectedPid("__none__"); return; }
    const q = search.toLowerCase();
    const first = appsRef.current.find(a => a.name.toLowerCase().includes(q));
    setSelectedPid(first ? String(first.pid) : "__none__");
  }, [search]); // intentionally excludes apps — must not fire on list changes

  const selectedApp = apps.find(a => String(a.pid) === selectedPid) ?? null;
  const selectedAppRef = useRef<AppProcess | null>(null);
  selectedAppRef.current = selectedApp;

  function handleQuit() {
    const app = selectedAppRef.current;
    if (!app) return;
    setSelectedPid("__none__");
    setSearch("");
    void quitApp(app.pid).catch(() => {});
  }

  function handleRestart() {
    const app = selectedAppRef.current;
    if (!app) return;
    setSelectedPid("__none__");
    setSearch("");
    void restartApp(app.pid, app.bundlePath).catch(() => {});
  }

  return (
    <Form
      header={<CardHeader title="App Manager" iconBundleId="com.apple.ActivityMonitor" />}
      actions={
        <ActionPanel layout="row">
          <Action
            title="Restart"
            onAction={handleRestart}
            style="secondary"
          />
          <Action
            title="Quit"
            onAction={handleQuit}
            style="primary"
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        name="search"
        value={search}
        onChange={setSearch}
        label="Search"
      />
      <Form.Dropdown
        name="app"
        value={selectedPid}
        onChange={setSelectedPid}
        label={apps.length === 0 ? "Loading..." : "Select App"}
      >
        <Form.Dropdown.Item key="__none__" value="__none__" title="Select an app..." />
        {filteredApps.map(app => (
          <Form.Dropdown.Item
            key={app.pid}
            value={String(app.pid)}
            title={app.name}
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

const ActivityMonitorWidget = defineWidget({
  name: "app-activity-manager",
  description:
    "This skill provides the ability to monitor and control running applications on the system. It allows the user to retrieve a real-time list of active processes, terminate specific applications, or restart them to resolve issues or refresh state.",
  component: ActivityMonitor,
});

export default ActivityMonitorWidget;
