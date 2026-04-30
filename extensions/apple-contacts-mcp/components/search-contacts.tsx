import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import { Contact, searchContacts } from "../helpers/contacts.js";

const schema = z.object({
  query: z.string().optional().describe("The name (or fragment) to search for."),
  limit: z.number().int().optional().describe("Maximum number of contacts to return. Defaults to 25."),
});

type Props = z.infer<typeof schema>;

const DEFAULT_LIMIT = 25;

function renderContact(contact: Contact): string {
  const lines: string[] = [];
  lines.push(`### ${contact.name}`);
  if (contact.organization) lines.push(`_${contact.organization}_`);
  if (contact.phones.length) {
    lines.push("");
    lines.push("**Phones:**");
    lines.push(...contact.phones.map((p) => `- \`${p}\``));
  }
  if (contact.emails.length) {
    lines.push("");
    lines.push("**Emails:**");
    lines.push(...contact.emails.map((e) => `- \`${e}\``));
  }
  return lines.join("\n");
}

function SearchContacts(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const [limit, setLimit] = useState<number | null>(props.limit ?? DEFAULT_LIMIT);
  const [results, setResults] = useState<Contact[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!query.trim()) return;
    setIsSearching(true);
    setError("");
    try {
      const contacts = await searchContacts(query.trim(), limit && limit > 0 ? limit : DEFAULT_LIMIT);
      setResults(contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSearching(false);
    }
  }

  function onDone() {
    if (results === null) {
      closeWidget("Search cancelled.");
      return;
    }
    closeWidget(`Found ${results.length} contact(s) matching "${query}".`);
  }

  const header = <CardHeader title="Search Contacts" iconBundleId="com.apple.AddressBook" />;

  if (results !== null) {
    const markdown = results.length
      ? results.map(renderContact).join("\n\n---\n\n")
      : `_No contacts matched **${query}**._`;
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="New Search" onSubmit={() => setResults(null)} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={markdown} />
        <Form.TextField name="query" label="Query" value={query} onChange={setQuery} isCopyable />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSearching ? "Searching..." : "Search"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSearching}
            isDisabled={!query.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="query" label="Name" value={query} onChange={setQuery} />
      <Form.NumberField name="limit" label="Max results" value={limit} onChange={setLimit} min={1} max={200} />
    </Form>
  );
}

const SearchContactsWidget = defineWidget({
  name: "search-contacts",
  description: "Search Apple Contacts by name and view phone numbers and email addresses.",
  schema,
  component: SearchContacts,
});

export default SearchContactsWidget;
