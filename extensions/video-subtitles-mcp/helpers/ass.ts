import type { TranscribedWord } from "./types.js";

const MAX_WORDS_PER_CHUNK = 4;
const MAX_CHUNK_DURATION = 1.8;
const MAX_GAP_WITHIN_CHUNK = 0.5;

interface Chunk {
  start: number;
  end: number;
  words: TranscribedWord[];
}

function chunkWords(words: TranscribedWord[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: TranscribedWord[] = [];
  let chunkStart = 0;

  for (const w of words) {
    const text = w.word.trim();
    if (!text) continue;

    const lastWord = current[current.length - 1];
    const gap = lastWord ? w.start - lastWord.end : 0;
    const wouldExceedDuration = current.length > 0 && w.end - chunkStart > MAX_CHUNK_DURATION;
    const wouldExceedWordCount = current.length >= MAX_WORDS_PER_CHUNK;
    const gapTooLarge = current.length > 0 && gap > MAX_GAP_WITHIN_CHUNK;
    const breakOnPunctuation = lastWord && /[.!?,;:]$/.test(lastWord.word.trim());

    if (wouldExceedDuration || wouldExceedWordCount || gapTooLarge || breakOnPunctuation) {
      if (current.length) chunks.push({ start: chunkStart, end: current[current.length - 1].end, words: current });
      current = [];
      chunkStart = w.start;
    }

    if (current.length === 0) chunkStart = w.start;
    current.push({ ...w, word: text });
  }
  if (current.length) chunks.push({ start: chunkStart, end: current[current.length - 1].end, words: current });
  return chunks;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total * 100) % 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\n/g, "\\N");
}

export function buildAss(words: TranscribedWord[]): string {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Primary=yellow highlight (&H0000FFFF=BGR), Secondary=white (pre-highlight), Outline=black
    "Style: Default,Arial Black,60,&H0000FFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,4,2,2,80,80,180,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");

  const chunks = chunkWords(words);
  const lines: string[] = [];
  for (const chunk of chunks) {
    const parts: string[] = [];
    for (const w of chunk.words) {
      const durationCs = Math.max(1, Math.round((w.end - w.start) * 100));
      parts.push(`{\\k${durationCs}}${escapeAssText(w.word)}`);
    }
    const text = parts.join(" ");
    lines.push(`Dialogue: 0,${formatTime(chunk.start)},${formatTime(chunk.end)},Default,,0,0,0,,${text}`);
  }

  return `${header}\n${lines.join("\n")}\n`;
}
