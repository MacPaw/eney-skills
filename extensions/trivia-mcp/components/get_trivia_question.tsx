import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .describe("Question difficulty. Defaults to medium."),
  category: z
    .string()
    .optional()
    .describe("Optional category name (e.g. 'Science', 'History', 'Geography'). Free-form; matched case-insensitively against Open Trivia DB categories."),
});

type Props = z.infer<typeof schema>;

interface RawQuestion {
  category: string;
  type: "multiple" | "boolean";
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

interface QuestionData {
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number;
}

const CATEGORIES_URL = "https://opentdb.com/api_category.php";

interface CategoryEntry {
  id: number;
  name: string;
}

let categoriesCache: CategoryEntry[] | null = null;

async function loadCategories(): Promise<CategoryEntry[]> {
  if (categoriesCache) return categoriesCache;
  const res = await fetch(CATEGORIES_URL);
  if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
  const data = await res.json() as { trivia_categories: CategoryEntry[] };
  categoriesCache = data.trivia_categories;
  return categoriesCache;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&aacute;/g, "á")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”");
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchQuestion(difficulty: string, categoryName?: string): Promise<QuestionData> {
  let categoryId: number | undefined;
  if (categoryName) {
    const cats = await loadCategories();
    const match = cats.find((c) => c.name.toLowerCase().includes(categoryName.toLowerCase()));
    if (match) categoryId = match.id;
  }

  const params = new URLSearchParams({
    amount: "1",
    type: "multiple",
    difficulty,
  });
  if (categoryId) params.set("category", String(categoryId));

  const url = `https://opentdb.com/api.php?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trivia API error ${res.status}`);
  const data = await res.json() as { response_code: number; results: RawQuestion[] };
  if (data.response_code !== 0 || data.results.length === 0) {
    throw new Error("No trivia question available for the selected filters.");
  }
  const q = data.results[0];
  const options = shuffle([q.correct_answer, ...q.incorrect_answers]).map(decodeHtml);
  const correctIndex = options.indexOf(decodeHtml(q.correct_answer));
  return {
    category: decodeHtml(q.category),
    difficulty: q.difficulty,
    question: decodeHtml(q.question),
    options,
    correctIndex,
  };
}

function Trivia(props: Props) {
  const closeWidget = useCloseWidget();
  const difficulty = props.difficulty ?? "medium";
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setRevealed(false);
    fetchQuestion(difficulty, props.category)
      .then((q) => {
        if (cancelled) return;
        setQuestion(q);
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

  function onReveal() {
    setRevealed(true);
  }

  function onAnother() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (question) {
      closeWidget(
        `Q: ${question.question}\n\nAnswer: ${question.options[question.correctIndex]} ` +
        `(${question.category}, ${question.difficulty}).`,
      );
    } else {
      closeWidget("Closed.");
    }
  }

  let markdown: string;
  if (status === "loading") {
    markdown = "_Loading question…_ ❓";
  } else if (status === "error") {
    markdown = `**Error:** ${errorMsg}`;
  } else if (question) {
    const lines = [
      `### ${question.question}`,
      ``,
      `_${question.category} · ${question.difficulty}_`,
      ``,
    ];
    question.options.forEach((opt, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C, D
      const marker =
        revealed && i === question.correctIndex ? "**✅" : "**";
      const closeMarker =
        revealed && i === question.correctIndex ? "**" : "**";
      lines.push(`- ${marker}${letter}.${closeMarker} ${opt}`);
    });
    if (revealed) {
      lines.push("");
      lines.push(
        `**Answer:** ${String.fromCharCode(65 + question.correctIndex)}. ${question.options[question.correctIndex]}`,
      );
    }
    markdown = lines.join("\n");
  } else {
    markdown = "";
  }

  return (
    <Form
      header={<CardHeader title="Trivia 🎲" iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          {!revealed && status === "done" && (
            <Action title="Reveal Answer" onAction={onReveal} style="primary" />
          )}
          <Action title="Another Question" onAction={onAnother} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
    </Form>
  );
}

const TriviaWidget = defineWidget({
  name: "get_trivia_question",
  description:
    "Get a random multiple-choice trivia question from Open Trivia DB. Hidden answer; reveal on demand. Optional difficulty and category filters.",
  schema,
  component: Trivia,
});

export default TriviaWidget;
