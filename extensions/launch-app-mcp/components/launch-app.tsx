import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { launchApp, listInstalledApps } from "../helpers/apps.js";

const schema = z.object({
  app: z.string().optional().describe("The name of the app to launch (matches a Finder application name)."),
});

type Props = z.infer<typeof schema>;

function LaunchApp(props: Props) {
  const closeWidget = useCloseWidget();
  const [app, setApp] = useState(props.app ?? "");
  const [apps, setApps] = useState<string[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listInstalledApps()
      .then((available) => {
        setApps(available);
        if (!app && available.length) setApp(available[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingList(false));
  }, []);

  async function onSubmit() {
    if (!app) return;
    setIsLaunching(true);
    setError("");
    try {
      await launchApp(app);
      closeWidget(`Launched ${app}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsLaunching(false);
    }
  }

  const header = <CardHeader title="Launch App" iconBundleId="com.apple.finder" />;

  if (isLoadingList) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Launch" onSubmit={onSubmit} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Scanning installed applications..." />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLaunching ? "Launching..." : "Launch"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLaunching}
            isDisabled={!app}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {apps.length > 0 ? (
        <Form.Dropdown name="app" label="Application" value={app} onChange={setApp} searchable>
          {apps.map((a) => (
            <Form.Dropdown.Item key={a} title={a} value={a} />
          ))}
        </Form.Dropdown>
      ) : (
        <Form.TextField name="app" label="Application" value={app} onChange={setApp} />
      )}
    </Form>
  );
}

const LaunchAppWidget = defineWidget({
  name: "launch-app",
  description:
    "Launch a macOS application by name via `open -a`. The dropdown is populated from /Applications, /System/Applications, /System/Applications/Utilities, and ~/Applications.",
  schema,
  component: LaunchApp,
});

export default LaunchAppWidget;
