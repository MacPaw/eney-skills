export const TEXT_TO_MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};

const MORSE_TO_TEXT: Record<string, string> = Object.fromEntries(
  Object.entries(TEXT_TO_MORSE).map(([k, v]) => [v, k]),
);

export function encodeMorse(text: string): string {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  return words
    .map((word) =>
      [...word]
        .map((c) => TEXT_TO_MORSE[c] ?? null)
        .filter((c): c is string => c !== null)
        .join(" "),
    )
    .filter(Boolean)
    .join("   ");
}

export interface DecodeResult {
  text: string;
  unknownTokens: string[];
}

export function decodeMorse(morse: string): DecodeResult {
  const unknownTokens: string[] = [];
  const text = morse
    .trim()
    .split(/\s{3,}|\s*\/\s*/)
    .map((wordChunk) =>
      wordChunk
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => {
          const decoded = MORSE_TO_TEXT[token];
          if (decoded === undefined) {
            unknownTokens.push(token);
            return "?";
          }
          return decoded;
        })
        .join(""),
    )
    .filter(Boolean)
    .join(" ");
  return { text, unknownTokens };
}
