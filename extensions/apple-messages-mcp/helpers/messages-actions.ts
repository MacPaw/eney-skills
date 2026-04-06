function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildSendScript(recipient: string, message: string): string {
  const safeRecipient = escapeAppleScript(recipient);
  const safeMessage = escapeAppleScript(message);
  return `tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${safeRecipient}" of targetService
  send "${safeMessage}" to targetBuddy
end tell`;
}

export function buildOpenScript(chatIdentifier?: string): string {
  if (chatIdentifier) {
    return `tell application "Messages" to activate
open location "messages://${chatIdentifier}"`;
  }
  return `tell application "Messages" to activate`;
}

export function sendMessage(
  runAppleScript: (script: string) => Promise<string>,
  recipient: string,
  message: string,
): Promise<string> {
  return runAppleScript(buildSendScript(recipient, message));
}

export function openMessagesChat(
  runAppleScript: (script: string) => Promise<string>,
  chatIdentifier?: string,
): Promise<string> {
  return runAppleScript(buildOpenScript(chatIdentifier));
}