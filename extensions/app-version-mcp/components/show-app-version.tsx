import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { AppInfo, InstalledApp, listInstalledApps, readAppInfo } from "../helpers/apps.js";

const schema = z.object({
  app: z.string().optional().describe("The name of the app whose version to read."),
});

type Props = z.infer<typeof schema>;

function ShowAppVersion(props: Props) {
  const closeWidget = useCloseWidget();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [selected, setSelected] = useState(props.app ?? "");
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listInstalledApps()
      .then((available) => {
        setApps(available);
        if (!selected && available.length) setSelected(available[0].name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingList(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const match = apps.find((a) => a.name === selected);
    if (!match) return;
    setIsReading(true);
    setError("");
    readAppInfo(match)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsReading(false));
  }, [selected, apps]);

  function onDone() {
    if (!info) closeWidget("No app inspected.");
    else closeWidget(`${info.name} ${info.version} (${info.build})`);
  }

  const header = <CardHeader title="App Version" iconBundleId={info?.bundleId || "com.apple.finder"} />;

  if (isLoadingList) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
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
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {apps.length > 0 ? (
        <Form.Dropdown name="app" label="Application" value={selected} onChange={setSelected} searchable>
          {apps.map((a) => (
            <Form.Dropdown.Item key={a.name} title={a.name} value={a.name} />
          ))}
        </Form.Dropdown>
      ) : (
        <Form.TextField name="app" label="Application" value={selected} onChange={setSelected} />
      )}
      {isReading && !info && <Paper markdown="Reading Info.plist..." />}
      {info && (
        <Paper
          markdown={[
            `### ${info.name}`,
            "",
            "| | |",
            "|---|---|",
            info.version ? `| **Version** | \`${info.version}\` |` : "",
            info.build ? `| **Build** | \`${info.build}\` |` : "",
            info.bundleId ? `| **Bundle ID** | \`${info.bundleId}\` |` : "",
            info.minimumSystemVersion ? `| **Min macOS** | \`${info.minimumSystemVersion}\` |` : "",
            `| **Path** | \`${info.path}\` |`,
          ]
            .filter(Boolean)
            .join("\n")}
        />
      )}
    </Form>
  );
}

const ShowAppVersionWidget = defineWidget({
  name: "show-app-version",
  description:
    "Show CFBundleShortVersionString, CFBundleVersion, CFBundleIdentifier, and minimum macOS version for an installed app by reading its Info.plist via plutil.",
  schema,
  component: ShowAppVersion,
});

export default ShowAppVersionWidget;
