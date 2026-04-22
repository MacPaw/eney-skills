import type { TranscribedWord } from "./types.js";

const STOPWORDS = new Set([
  "the", "and", "a", "an", "is", "it", "to", "of", "in", "for", "on", "with",
  "that", "this", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "but", "or", "not", "no", "yes", "can", "could",
  "will", "would", "should", "i", "you", "he", "she", "we", "they", "them",
  "my", "your", "our", "their", "me", "him", "her", "us", "so", "if", "at",
  "as", "by", "from", "there", "here", "what", "when", "where", "who", "why",
  "how", "all", "any", "just", "like", "get", "got", "one", "two", "three",
  "really", "very", "going", "gonna", "now", "well", "know", "think", "about",
  "some", "out", "up", "down", "over", "into", "then", "than", "because",
  "only", "also", "too", "more", "most", "much", "many", "says", "said",
  "take", "make", "made", "goes", "went", "come", "came", "let", "lets",
  "yeah", "okay", "right", "thing", "things", "stuff",
]);

export interface CaptionDraft {
  title: string;
  description: string;
  hashtags: string[];
}

const TITLE_LIMIT = 70;
const DESCRIPTION_LIMIT = 300;
const HASHTAG_COUNT = 8;

export function generateCaption(words: TranscribedWord[]): CaptionDraft {
  const text = words.map((w) => w.word).join(" ").replace(/\s+/g, " ").trim();

  const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0]?.trim().replace(/[.!?]+$/, "") ?? text;
  const rawTitle = firstSentence || text;
  const title = truncate(rawTitle, TITLE_LIMIT);

  const description = truncate(text, DESCRIPTION_LIMIT);

  const tokens = text.toLowerCase().match(/[\p{L}\p{N}'\-]{3,}/gu) ?? [];
  const counts = new Map<string, number>();
  for (const raw of tokens) {
    const w = raw.replace(/^['\-]+|['\-]+$/g, "");
    if (!w || STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const hashtags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, HASHTAG_COUNT)
    .map(([w]) => `#${w.replace(/[^\p{L}\p{N}]/gu, "")}`)
    .filter((h) => h.length > 1);

  return { title, description, hashtags };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}
