import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const TYPES = [
  "education",
  "recreational",
  "social",
  "diy",
  "charity",
  "cooking",
  "relaxation",
  "music",
  "busywork",
] as const;

const schema = z.object({
  type: z
    .enum(TYPES)
    .optional()
    .describe(`Optional activity type filter. One of: ${TYPES.join(", ")}.`),
  participants: z
    .number()
    .int()
    .optional()
    .describe("Optional desired number of participants (1–8)."),
});

type Props = z.infer<typeof schema>;

interface Activity {
  activity: string;
  type: string;
  participants: number;
  price: number;
  accessibility: string;
  duration: string;
  kidFriendly: boolean;
  link: string;
  key: string;
}

async function fetchActivity(type?: string, participants?: number): Promise<Activity> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (participants && participants > 0) params.set("participants", String(participants));
  const url = params.toString()
    ? `https://bored-api.appbrewery.com/filter?${params.toString()}`
    : "https://bored-api.appbrewery.com/random";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bored API error ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error("No matching activities.");
    return data[Math.floor(Math.random() * data.length)] as Activity;
  }
  return data as Activity;
}

function priceLabel(p: number): string {
  if (p === 0) return "free";
  if (p < 0.3) return "cheap";
  if (p < 0.7) return "moderate";
  return "expensive";
}

function buildMarkdown(a: Activity): string {
  return [
    `### 💡 ${a.activity}`,
    "",
    `| | |`,
    `|---|---|`,
    `| Type | ${a.type} |`,
    `| Participants | ${a.participants} |`,
    `| Price | ${priceLabel(a.price)} |`,
    `| Accessibility | ${a.accessibility} |`,
    `| Duration | ${a.duration} |`,
    `| Kid friendly | ${a.kidFriendly ? "yes" : "no"} |`,
    ...(a.link ? ["", `[More info](${a.link})`] : []),
    "",
    `_bored-api.appbrewery.com · key ${a.key}_`,
  ].join("\n");
}

function BoredActivity(props: Props) {
  const closeWidget = useCloseWidget();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchActivity(props.type, props.participants)
      .then((a) => {
        if (cancelled) return;
        setActivity(a);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onAnother() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (activity) {
      closeWidget(`Try this: ${activity.activity} (${activity.type}, ${activity.participants} participant${activity.participants === 1 ? "" : "s"}, ${priceLabel(activity.price)}).`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Picking an activity…_ ✨"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : activity
          ? buildMarkdown(activity)
          : "";

  return (
    <Form
      header={<CardHeader title="Bored?" iconBundleId="com.apple.iCal" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Another idea" onAction={onAnother} style="secondary" />
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const BoredWidget = defineWidget({
  name: "suggest_activity",
  description:
    "Suggest a random activity to beat boredom, sourced from bored-api.appbrewery.com (free, no key). Optional filters: activity type and desired number of participants.",
  schema,
  component: BoredActivity,
});

export default BoredWidget;
