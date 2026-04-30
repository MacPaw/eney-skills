import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  breed: z
    .string()
    .optional()
    .describe(
      "Optional breed name (e.g. 'beagle', 'husky', 'goldenretriever'). Sub-breeds use a slash, e.g. 'retriever/golden'.",
    ),
});

type Props = z.infer<typeof schema>;

interface DogImage {
  url: string;
  breed: string;
}

function extractBreedFromUrl(url: string): string {
  const m = url.match(/\/breeds\/([^/]+)\//);
  if (!m) return "Unknown";
  const slug = m[1];
  return slug.split("-").reverse().join(" ");
}

async function fetchImage(breed?: string): Promise<DogImage> {
  let url: string;
  const cleaned = breed?.trim().toLowerCase();
  if (cleaned) {
    // Sub-breed: "breed/sub" → /breed/{breed}/{sub}/images/random
    if (cleaned.includes("/")) {
      const [main, sub] = cleaned.split("/").map((s) => s.trim());
      url = `https://dog.ceo/api/breed/${encodeURIComponent(main)}/${encodeURIComponent(sub)}/images/random`;
    } else {
      url = `https://dog.ceo/api/breed/${encodeURIComponent(cleaned)}/images/random`;
    }
  } else {
    url = "https://dog.ceo/api/breeds/image/random";
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`dog.ceo error ${res.status}`);
  const data = await res.json() as { message: string; status: string };
  if (data.status !== "success") {
    throw new Error(`dog.ceo returned: ${data.message}`);
  }
  return {
    url: data.message,
    breed: cleaned ? cleaned.replace("/", " ") : extractBreedFromUrl(data.message),
  };
}

function DogImageWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [breed, setBreed] = useState(props.breed ?? "");
  const [image, setImage] = useState<DogImage | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchImage(breed)
      .then((img) => {
        if (cancelled) return;
        setImage(img);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onAnother() {
    setReloadCount((c) => c + 1);
  }

  function onClearBreed() {
    setBreed("");
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (image) {
      closeWidget(`Random dog (${image.breed}): ${image.url}`);
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Fetching pup…_ 🐕"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : image
          ? [
              `### 🐶 ${image.breed[0].toUpperCase() + image.breed.slice(1)}`,
              ``,
              `![dog](${image.url})`,
              ``,
              `_[Open image](${image.url}) · dog.ceo_`,
            ].join("\n")
          : "";

  return (
    <Form
      header={<CardHeader title="Random Dog" iconBundleId="com.apple.Emoji" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Fetch" onSubmit={onAnother} style="primary" />
          <Action title="Another One" onAction={onAnother} style="secondary" />
          <Action title="Any Breed" onAction={onClearBreed} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="breed"
        label="Breed (optional, e.g. beagle, retriever/golden)"
        value={breed}
        onChange={setBreed}
      />
    </Form>
  );
}

const DogImageWidgetDef = defineWidget({
  name: "get_dog_image",
  description:
    "Get a random dog image from dog.ceo (free, no key). Optional breed filter; sub-breeds use a slash (e.g. 'retriever/golden').",
  schema,
  component: DogImageWidget,
});

export default DogImageWidgetDef;
