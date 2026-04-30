// Caesar cipher with optional ROT5 for digits.
// Shift is applied modulo 26 for letters, modulo 10 for digits when shiftDigits=true.

export interface CipherOptions {
  shift: number;
  shiftDigits: boolean;
}

export function caesar(text: string, options: CipherOptions): string {
  const shift = ((options.shift % 26) + 26) % 26;
  const digitShift = ((options.shift % 10) + 10) % 10;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((code - 65 + shift) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((code - 97 + shift) % 26) + 97);
    } else if (options.shiftDigits && code >= 48 && code <= 57) {
      out += String.fromCharCode(((code - 48 + digitShift) % 10) + 48);
    } else {
      out += text[i];
    }
  }
  return out;
}

export function rot13(text: string): string {
  return caesar(text, { shift: 13, shiftDigits: false });
}
