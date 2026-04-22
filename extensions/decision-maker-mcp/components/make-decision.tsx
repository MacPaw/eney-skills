import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, CardHeader, defineWidget, useCloseWidget } from "@eney/api";
import { compareOptions, generateRollReasoning, parseOptions, getApiKey } from "../helpers/compare.js";
import { saveApiKey } from "../helpers/keychain.js";

const schema = z.object({
  question: z.string().optional().describe("Pass the user's exact original message here. Examples: 'Pizza or sushi?', 'Should I go to the gym or stay in bed?', 'React, Vue, or Svelte?'"),
});

type Props = z.infer<typeof schema>;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface RollResult { chosen: string; reasoning: string }

const PARSE_ERROR = "**Couldn't parse options.** Try: *Pizza or sushi?* or *React, Vue, Svelte*";
const ICON = "com.apple.Shortcuts";

// — Pending action — tracked so API key setup knows what to resume
type PendingAction = "roll" | "compare";

function MakeDecision(props: Props) {
  const closeWidget = useCloseWidget();
  const [question, setQuestion] = useState(props.question ?? "");

  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [comparison, setComparison] = useState("");
  const [isRolling, setIsRolling] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState("");

  // API key setup
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>("roll");
  const [apiKeyInput, setApiKeyInput] = useState("");

  function clearResults() {
    setRollResult(null);
    setComparison("");
    setError("");
  }

  function handleQuestionChange(v: string) {
    setQuestion(v);
    setError("");
  }

  // — Roll —

  async function performRoll(apiKey: string) {
    const options = parseOptions(question);
    if (options.length < 2) { setError(PARSE_ERROR); return; }
    const chosen = pick(options);
    setNeedsApiKey(false);
    setIsRolling(true);
    setError("");
    try {
      const reasoning = await generateRollReasoning(options, chosen, apiKey);
      setRollResult({ chosen, reasoning });
    } catch (e) {
      setError(`**Error:** ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsRolling(false);
    }
  }

  async function onRoll() {
    const key = getApiKey();
    if (!key) { setPendingAction("roll"); setNeedsApiKey(true); return; }
    await performRoll(key);
  }

  async function onRollAgain() {
    const key = getApiKey();
    if (key) await performRoll(key);
  }

  // — Compare —

  async function performCompare(apiKey: string) {
    setNeedsApiKey(false);
    setIsComparing(true);
    setError("");
    try {
      const result = await compareOptions(question, apiKey);
      setComparison(result);
    } catch (e) {
      setError(`**Error:** ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsComparing(false);
    }
  }

  async function onCompare() {
    const key = getApiKey();
    if (!key) { setPendingAction("compare"); setNeedsApiKey(true); return; }
    await performCompare(key);
  }

  // — API key setup —

  async function onSaveKey() {
    const key = apiKeyInput.trim();
    if (!key) return;
    try {
      saveApiKey(key);
    } catch (e) {
      setError(`**Failed to save key:** ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (pendingAction === "roll") await performRoll(key);
    else await performCompare(key);
  }

  // — Views —

  // Roll result
  if (rollResult) {
    return (
      <Form
        header={<CardHeader title="Decision Maker" iconBundleId={ICON} />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Roll Again 🎲" onSubmit={onRollAgain} style="secondary" isLoading={isRolling} />
            <Action.SubmitForm title="New Question" onSubmit={clearResults} style="secondary" />
            <Action title="Done" onAction={() => closeWidget(`Picked ${rollResult.chosen} for the user.`)} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`# The verdict: **${rollResult.chosen}**\n\n${rollResult.reasoning}`} />
      </Form>
    );
  }

  // Compare result
  if (comparison) {
    return (
      <Form
        size="large"
        header={<CardHeader title="Decision Maker" iconBundleId={ICON} />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="New Question" onSubmit={clearResults} style="secondary" />
            <Action.SubmitForm title="Compare Again ⚖️" onSubmit={() => setComparison("")} style="secondary" />
            <Action title="Done" onAction={() => closeWidget("Showed the user an options comparison in the widget.")} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={comparison} />
      </Form>
    );
  }

  // One-time API key setup
  if (needsApiKey) {
    return (
      <Form
        header={<CardHeader title="Decision Maker" iconBundleId={ICON} />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Cancel" onSubmit={() => setNeedsApiKey(false)} style="secondary" />
            <Action.SubmitForm
              title="Save & Continue"
              onSubmit={onSaveKey}
              style="primary"
              isDisabled={!apiKeyInput.trim()}
            />
          </ActionPanel>
        }
      >
        <Paper markdown="**One-time setup.** Your Anthropic API key will be saved to macOS Keychain and used automatically from now on." />
        <Form.PasswordField name="apiKey" label="Anthropic API Key" value={apiKeyInput} onChange={setApiKeyInput} />
        {error && <Paper markdown={error} />}
      </Form>
    );
  }

  // Main input
  return (
    <Form
      header={<CardHeader title="Decision Maker" iconBundleId={ICON} />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title={isRolling ? "Rolling... 🎲" : "Roll the Dice 🎲"}
            onSubmit={onRoll}
            style="primary"
            isLoading={isRolling}
            isDisabled={!question.trim()}
          />
          <Action.SubmitForm
            title={isComparing ? "Comparing... ⚖️" : "Compare ⚖️"}
            onSubmit={onCompare}
            style="primary"
            isLoading={isComparing}
            isDisabled={!question.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={error} />}
      <Form.TextField
        name="question"
        label="What can't you decide?"
        value={question}
        onChange={handleQuestionChange}
      />
    </Form>
  );
}

const MakeDecisionWidget = defineWidget({
  name: "make-decision",
  description: "Use when the user asks a decision question or can't choose between options. Triggers on: 'Should I...?', 'X or Y?', 'help me decide', 'which is better', 'compare X vs Y'. Two modes: Roll the Dice (picks one with funny AI reasoning + twisted proverbs) and Compare (feature table + scenario summary).",
  schema,
  component: MakeDecision,
});

export default MakeDecisionWidget;
