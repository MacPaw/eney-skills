import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { isPalindrome, isAnagram, findPalindromes, normalize, reverse } from "../helpers/palindrome.js";

const schema = z.object({
  text: z.string().describe("Text to check."),
  compareWith: z.string().optional().describe("Optional second text to test as an anagram of `text`."),
  ignoreCase: z.boolean().optional().describe("Case-insensitive comparison. Default: true."),
  ignorePunctuation: z
    .boolean()
    .optional()
    .describe("Ignore non-alphanumeric characters when comparing. Default: true."),
});

type Props = z.infer<typeof schema>;

interface Analysis {
  text: string;
  normalized: string;
  reversed: string;
  isPal: boolean;
  anagramTarget: string | null;
  anagramResult: boolean | null;
  palindromicSubs: string[];
}

function analyze(text: string, compareWith: string, ignoreCase: boolean, ignorePunctuation: boolean): Analysis {
  const opts = { ignoreCase, ignorePunctuation };
  const normalized = normalize(text, opts);
  const palindromicSubs = findPalindromes(text, { ...opts, minLength: 3, maxResults: 30 });
  return {
    text,
    normalized,
    reversed: reverse(normalized),
    isPal: isPalindrome(text, opts),
    anagramTarget: compareWith.trim() ? compareWith : null,
    anagramResult: compareWith.trim() ? isAnagram(text, compareWith, opts) : null,
    palindromicSubs,
  };
}

function buildMarkdown(a: Analysis): string {
  const lines: string[] = [];
  if (a.text.trim() === "") {
    return "_Enter text to analyse._";
  }
  if (a.isPal) {
    lines.push(`### ✅ **Palindrome**`);
  } else {
    lines.push(`### ❌ Not a palindrome`);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Original | \`${a.text}\` |`);
  lines.push(`| Normalised | \`${a.normalized || "(empty)"}\` |`);
  lines.push(`| Reversed | \`${a.reversed || "(empty)"}\` |`);
  if (a.anagramTarget !== null) {
    lines.push(
      `| Anagram of \`${a.anagramTarget}\` | ${a.anagramResult ? "✅ yes" : "❌ no"} |`,
    );
  }
  if (a.palindromicSubs.length > 0) {
    lines.push("");
    lines.push(`**Palindromic substrings (≥3 chars, after normalisation):**`);
    lines.push("");
    lines.push(a.palindromicSubs.map((s) => `\`${s}\``).join(" · "));
  }
  return lines.join("\n");
}

function PalindromeChecker(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text);
  const [compareWith, setCompareWith] = useState(props.compareWith ?? "");
  const [ignoreCase, setIgnoreCase] = useState<boolean>(props.ignoreCase ?? true);
  const [ignorePunctuation, setIgnorePunctuation] = useState<boolean>(props.ignorePunctuation ?? true);
  const [analysis, setAnalysis] = useState<Analysis>(() =>
    analyze(props.text, props.compareWith ?? "", props.ignoreCase ?? true, props.ignorePunctuation ?? true),
  );

  function recompute(opts?: Partial<{ t: string; c: string; ic: boolean; ip: boolean }>) {
    const t = opts?.t ?? text;
    const c = opts?.c ?? compareWith;
    const ic = opts?.ic ?? ignoreCase;
    const ip = opts?.ip ?? ignorePunctuation;
    setAnalysis(analyze(t, c, ic, ip));
  }

  function onCheck() {
    recompute();
  }

  function onToggleCase() {
    const v = !ignoreCase;
    setIgnoreCase(v);
    recompute({ ic: v });
  }

  function onTogglePunct() {
    const v = !ignorePunctuation;
    setIgnorePunctuation(v);
    recompute({ ip: v });
  }

  function onDone() {
    let payload = `"${analysis.text}" — ${analysis.isPal ? "palindrome" : "not a palindrome"} ` +
      `(normalised: "${analysis.normalized}").`;
    if (analysis.anagramTarget !== null) {
      payload += ` Anagram of "${analysis.anagramTarget}": ${analysis.anagramResult ? "yes" : "no"}.`;
    }
    if (analysis.palindromicSubs.length > 0) {
      payload += ` Palindromic substrings: ${analysis.palindromicSubs.join(", ")}.`;
    }
    closeWidget(payload);
  }

  return (
    <Form
      header={<CardHeader title="Palindrome Checker" iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Check" onSubmit={onCheck} style="primary" />
          <Action
            title={ignoreCase ? "Case sensitive" : "Ignore case"}
            onAction={onToggleCase}
            style="secondary"
          />
          <Action
            title={ignorePunctuation ? "Include punctuation" : "Ignore punctuation"}
            onAction={onTogglePunct}
            style="secondary"
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(analysis)} />
      <Form.TextField name="text" label="Text" value={text} onChange={setText} />
      <Form.TextField
        name="compareWith"
        label="Compare with (anagram check, optional)"
        value={compareWith}
        onChange={setCompareWith}
      />
    </Form>
  );
}

const PalindromeWidget = defineWidget({
  name: "check_palindrome",
  description:
    "Check whether text is a palindrome (reads the same forward and backward), find palindromic substrings, and optionally test anagram equivalence with a second string. Configurable case-insensitivity and punctuation-ignoring; pure local computation.",
  schema,
  component: PalindromeChecker,
});

export default PalindromeWidget;
