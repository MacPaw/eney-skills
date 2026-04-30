const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "vivamus", "donec",
  "porta", "vel", "luctus", "vitae", "tincidunt", "ligula", "fringilla", "nec",
  "augue", "metus", "vehicula", "lacinia", "varius", "diam", "fermentum",
  "interdum", "etiam", "sapien", "ornare", "rhoncus", "nullam", "tristique",
  "egestas", "tellus", "phasellus",
];

const STARTER = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

function pickWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function makeSentence(): string {
  const length = 5 + Math.floor(Math.random() * 10);
  const words: string[] = [];
  for (let i = 0; i < length; i += 1) words.push(pickWord());
  let body = words.join(" ");
  const commaCount = Math.floor(length / 7);
  for (let i = 0; i < commaCount; i += 1) {
    const idx = 2 + Math.floor(Math.random() * (length - 3));
    const splitWords = body.split(" ");
    if (splitWords[idx] && !splitWords[idx].endsWith(",")) splitWords[idx] = splitWords[idx] + ",";
    body = splitWords.join(" ");
  }
  return body.charAt(0).toUpperCase() + body.slice(1) + ".";
}

function makeParagraph(): string {
  const length = 3 + Math.floor(Math.random() * 5);
  const sentences: string[] = [];
  for (let i = 0; i < length; i += 1) sentences.push(makeSentence());
  return sentences.join(" ");
}

export function generateWords(count: number, startWithLorem: boolean): string {
  const out: string[] = [];
  if (startWithLorem) {
    const seed = "lorem ipsum dolor sit amet consectetur adipiscing elit".split(" ");
    out.push(...seed.slice(0, count));
  }
  while (out.length < count) out.push(pickWord());
  return out.slice(0, count).join(" ");
}

export function generateSentences(count: number, startWithLorem: boolean): string {
  const out: string[] = [];
  if (startWithLorem && count > 0) out.push(STARTER);
  while (out.length < count) out.push(makeSentence());
  return out.slice(0, count).join(" ");
}

export function generateParagraphs(count: number, startWithLorem: boolean): string {
  const out: string[] = [];
  if (startWithLorem && count > 0) {
    const rest = makeParagraph();
    out.push(`${STARTER} ${rest}`);
  }
  while (out.length < count) out.push(makeParagraph());
  return out.slice(0, count).join("\n\n");
}
