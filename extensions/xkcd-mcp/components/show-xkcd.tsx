import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

type Mode = "latest" | "specific" | "random";

const schema = z.object({
  mode: z.enum(["latest", "specific", "random"]).optional().describe("Which comic to fetch. Defaults to 'latest'."),
  number: z.number().int().optional().describe("Specific comic number (used when mode is 'specific')."),
});

type Props = z.infer<typeof schema>;

interface Comic {
  num: number;
  title: string;
  alt: string;
  img: string;
  year: string;
  month: string;
  day: string;
}

interface RawComic {
  num?: number;
  title?: string;
  alt?: string;
  img?: string;
  year?: string;
  month?: string;
  day?: string;
}

async function fetchComic(num?: number): Promise<Comic> {
  const url = num === undefined ? "https://xkcd.com/info.0.json" : `https://xkcd.com/${num}/info.0.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`xkcd API returned ${res.status}`);
  const json = (await res.json()) as RawComic;
  return {
    num: json.num ?? 0,
    title: json.title ?? "",
    alt: json.alt ?? "",
    img: json.img ?? "",
    year: json.year ?? "",
    month: json.month ?? "",
    day: json.day ?? "",
  };
}

function ShowXkcd(props: Props) {
  const closeWidget = useCloseWidget();
  const [mode, setMode] = useState<Mode>(props.mode ?? "latest");
  const [number, setNumber] = useState<number | null>(props.number ?? null);
  const [comic, setComic] = useState<Comic | null>(null);
  const [latestNum, setLatestNum] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(targetMode: Mode, targetNumber: number | null) {
    setIsLoading(true);
    setError("");
    try {
      let target: number | undefined;
      if (targetMode === "latest") {
        target = undefined;
      } else if (targetMode === "random") {
        if (latestNum === null) {
          const latest = await fetchComic();
          setLatestNum(latest.num);
          target = 1 + Math.floor(Math.random() * latest.num);
        } else {
          target = 1 + Math.floor(Math.random() * latestNum);
        }
      } else {
        target = targetNumber ?? undefined;
        if (target === undefined) throw new Error("Pick a comic number first.");
      }
      const result = await fetchComic(target);
      setComic(result);
      if (targetMode === "latest") setLatestNum(result.num);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (mode === "latest" && !comic) load("latest", null);
  }, []);

  function onDone() {
    if (!comic) closeWidget("No comic loaded.");
    else closeWidget(`xkcd #${comic.num} — ${comic.title}`);
  }

  return (
    <Form
      header={<CardHeader title="XKCD" iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isLoading ? "Loading..." : mode === "specific" ? "Fetch" : mode === "random" ? "Roll" : "Refresh"}
            onSubmit={() => load(mode, number)}
            style="primary"
            isLoading={isLoading}
          />
          {comic && <Action.CopyToClipboard title="Copy URL" content={`https://xkcd.com/${comic.num}/`} />}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Form.Dropdown name="mode" label="Mode" value={mode} onChange={(v) => setMode(v as Mode)}>
        <Form.Dropdown.Item title="Latest" value="latest" />
        <Form.Dropdown.Item title="Specific number" value="specific" />
        <Form.Dropdown.Item title="Random" value="random" />
      </Form.Dropdown>
      {mode === "specific" && (
        <Form.NumberField name="number" label="Comic number" value={number} onChange={setNumber} min={1} />
      )}
      {error && <Paper markdown={`**Error:** ${error}`} />}
      {comic && (
        <Paper
          markdown={[
            `### #${comic.num} — ${comic.title}`,
            `_${comic.year}-${comic.month.padStart(2, "0")}-${comic.day.padStart(2, "0")}_`,
            "",
            `![${comic.title}](${comic.img})`,
            "",
            `_${comic.alt}_`,
            "",
            `[xkcd.com/${comic.num}/](https://xkcd.com/${comic.num}/)`,
          ].join("\n")}
        />
      )}
    </Form>
  );
}

const ShowXkcdWidget = defineWidget({
  name: "show-xkcd",
  description:
    "Show the latest, a specific, or a random xkcd comic by calling the public xkcd JSON API. Renders the title, image, and hover-text alt; the comic itself is loaded directly from xkcd's CDN.",
  schema,
  component: ShowXkcd,
});

export default ShowXkcdWidget;
