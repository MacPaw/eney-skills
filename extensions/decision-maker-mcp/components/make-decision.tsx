import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, CardHeader, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  question: z.string().optional().describe("The decision question, e.g. 'Pizza or sushi?' or 'Should I go for a run or stay in bed?'"),
});

type Props = z.infer<typeof schema>;

const REASONING_TEMPLATES = [
  (option: string) => `The universe has spoken. **${option}** it is. No further questions.`,
  (option: string) => `Mercury is in retrograde, but **${option}** still wins. Especially Mercury.`,
  (option: string) => `Your gut said **${option}**. Your gut has a 94.7% success rate. Trust the gut.`,
  (option: string) => `The ancient scrolls foretold this moment. They said **${option}**. Also something about a badger, but that part's classified.`,
  (option: string) => `Studies show that 73% of people who chose **${option}** had a noticeably better Tuesday. Coincidence? Scientists say no.`,
  (option: string) => `I asked a Magic 8-Ball, a coin flip, and a golden retriever. All three said **${option}**. That's a consensus.`,
  (option: string) => `Statistically speaking, **${option}** is the correct answer. The statistics are vibes-based but very confident.`,
  (option: string) => `Your future self already did **${option}** and is very happy about it. Don't let your future self down.`,
  (option: string) => `A bird flew past my window as I processed your question. Left to right. That means **${option}**. Bird science is real.`,
  (option: string) => `I ran 1,000 simulations. In 997 of them, **${option}** led to better outcomes. In the other 3, a llama was involved. Ignore those.`,
  (option: string) => `**${option}** has better energy right now. I can feel it through the screen. It's practically glowing.`,
  (option: string) => `The last person who *didn't* choose **${option}** is fine, technically, but their houseplants look sad. Just saying.`,
];

function parseOptions(question: string): string[] {
  const cleaned = question.trim().replace(/\?$/, "");

  // "X or Y" or "X, Y, or Z"
  const orPattern = /(.+?)\s+or\s+(.+)/i;
  const orMatch = cleaned.match(orPattern);
  if (orMatch) {
    const left = orMatch[1].replace(/^(should i|do i|can i|will i|would i|shall i)\s+/i, "").trim();
    const right = orMatch[2].trim();

    // Check for comma-separated left side: "X, Y, or Z"
    const leftParts = left.split(/\s*,\s*/);
    const all = [...leftParts, right].map((o) => o.trim()).filter(Boolean);
    if (all.length >= 2) return all;
  }

  // Comma-separated: "X, Y, Z"
  const commaParts = cleaned.split(/\s*,\s*/).map((o) => o.trim()).filter(Boolean);
  if (commaParts.length >= 2) return commaParts;

  return [];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Decision {
  chosen: string;
  reasoning: string;
}

function decide(question: string): Decision | null {
  const options = parseOptions(question);
  if (options.length < 2) return null;
  const chosen = pick(options);
  const template = pick(REASONING_TEMPLATES);
  return { chosen, reasoning: template(chosen) };
}

function MakeDecision(props: Props) {
  const closeWidget = useCloseWidget();
  const [question, setQuestion] = useState(props.question ?? "");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [parseError, setParseError] = useState(false);

  function onDecide() {
    const result = decide(question);
    if (!result) {
      setParseError(true);
      setDecision(null);
    } else {
      setParseError(false);
      setDecision(result);
    }
  }

  function onRoll() {
    const result = decide(question);
    if (result) setDecision(result);
  }

  function onReset() {
    setDecision(null);
    setParseError(false);
  }

  function onDone() {
    closeWidget(decision ? `Decided: ${decision.chosen}` : "No decision made.");
  }

  if (decision) {
    const markdown = `# The verdict is in\n\n${decision.reasoning}`;
    return (
      <Form
        header={<CardHeader title="Decision Maker" iconBundleId="com.apple.finder" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Roll Again" onSubmit={onRoll} style="secondary" />
            <Action.SubmitForm title="New Question" onSubmit={onReset} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={markdown} />
      </Form>
    );
  }

  const errorNote = parseError
    ? `**Hmm, I couldn't figure out the options.**\n\nTry phrasing it like:\n- *Pizza or sushi?*\n- *Should I go for a run or stay in bed?*\n- *Coffee, tea, or chaos?*`
    : "";

  return (
    <Form
      header={<CardHeader title="Decision Maker" iconBundleId="com.apple.finder" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Decide for Me"
            onSubmit={onDecide}
            style="primary"
            isDisabled={!question.trim()}
          />
        </ActionPanel>
      }
    >
      {parseError && <Paper markdown={errorNote} />}
      <Form.TextField
        name="question"
        label="What can't you decide?"
        value={question}
        onChange={(v) => { setQuestion(v); setParseError(false); }}
      />
    </Form>
  );
}

const MakeDecisionWidget = defineWidget({
  name: "make-decision",
  description: "Picks one option for you with a funny, confident reasoning when you can't decide",
  schema,
  component: MakeDecision,
});

export default MakeDecisionWidget;
