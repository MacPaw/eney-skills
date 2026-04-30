export interface LuhnResult {
  digits: string;
  isValid: boolean;
  sum: number;
  checkDigit: number;
  suggestedFullNumber: string;
}

export function stripFormatting(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function luhnSum(digits: string): number {
  let sum = 0;
  let parity = digits.length % 2;
  for (let i = 0; i < digits.length; i += 1) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) throw new Error("Non-digit input.");
    if (i % 2 === parity) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum;
}

export function evaluate(input: string): LuhnResult {
  const digits = stripFormatting(input);
  if (!digits) throw new Error("Empty input.");
  if (!/^\d+$/.test(digits)) throw new Error("Input must contain only digits.");
  const sum = luhnSum(digits);
  const isValid = sum % 10 === 0;

  const body = digits.slice(0, -1);
  const partialSum = luhnSum(body + "0");
  const checkDigit = (10 - (partialSum % 10)) % 10;

  return {
    digits,
    isValid,
    sum,
    checkDigit,
    suggestedFullNumber: body + String(checkDigit),
  };
}

export function detectCardType(digits: string): string | null {
  if (/^4\d{12}(\d{3}|\d{6})?$/.test(digits)) return "Visa";
  if (/^(5[1-5]\d{14}|2(2[2-9]\d|[3-6]\d\d|7[01]\d|720)\d{12})$/.test(digits)) return "Mastercard";
  if (/^3[47]\d{13}$/.test(digits)) return "American Express";
  if (/^6(?:011|5\d\d)\d{12,15}$/.test(digits)) return "Discover";
  if (/^3(?:0[0-5]|[68]\d)\d{11}$/.test(digits)) return "Diners Club";
  if (/^35(2[89]|[3-8]\d)\d{12}$/.test(digits)) return "JCB";
  if (/^\d{15}$/.test(digits)) return "IMEI / 15-digit identifier";
  return null;
}
