const FUNCTIONS = ["sqrt", "abs", "floor", "ceil", "round", "log", "log2", "log10", "sin", "cos", "tan", "asin", "acos", "atan", "exp", "min", "max", "pow"];
const CONSTANTS: Record<string, string> = {
  pi: "Math.PI",
  PI: "Math.PI",
  e: "Math.E",
  E: "Math.E",
  ln: "Math.log",
};

export function evaluateExpression(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty expression.");

  let expr = trimmed.replace(/\^/g, "**");

  expr = expr.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (_match, name: string) => {
    if (CONSTANTS[name]) return CONSTANTS[name];
    if (FUNCTIONS.includes(name)) return `Math.${name}`;
    throw new Error(`Unknown identifier: ${name}`);
  });

  if (!/^[0-9+\-*/%().,\s eE]*(?:Math\.[a-zA-Z]+[0-9+\-*/%().,\s eE]*)*$/.test(expr)) {
    throw new Error("Expression contains disallowed characters.");
  }

  let result: unknown;
  try {
    result = Function(`"use strict"; return (${expr});`)();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Result is not a finite number.");
  }
  return result;
}
