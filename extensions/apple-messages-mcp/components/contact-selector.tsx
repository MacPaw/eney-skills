import { useEffect, useState } from "react";
import { Form, Paper } from "@eney/api";
import { searchContacts } from "../helpers/contacts.js";

interface ContactItem {
  label: string;
  value: string;
}

function flattenContacts(contacts: { name: string; phones: string[]; emails: string[] }[]): ContactItem[] {
  const items: ContactItem[] = [];
  for (const c of contacts) {
    for (const phone of c.phones) {
      items.push({ label: `${c.name} — ${phone}`, value: phone });
    }
    for (const email of c.emails) {
      items.push({ label: `${c.name} — ${email}`, value: email });
    }
  }
  return items;
}

interface ContactSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string, label: string) => void;
  initialQuery?: string;
  label?: string;
}

export function ContactSelector({ value, onChange, onSelect, initialQuery = "", label = "To" }: ContactSelectorProps) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    searchContacts(initialQuery)
      .then((all) => setContacts(flattenContacts(all)))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <Paper markdown="_Loading contacts…_" />;
  }

  return (
    <Form.Dropdown
      name="contact"
      label={label}
      value={value}
      onChange={(v) => {
        onChange(v);
        if (onSelect) {
          const item = contacts.find((c) => c.value === v);
          onSelect(v, item?.label ?? v);
        }
      }}
      searchable
    >
      {initialQuery === "" && <Form.Dropdown.Item key="" title="" value="" />}
      {contacts.map((c) => (
        <Form.Dropdown.Item key={c.value} title={c.label} value={c.value} />
      ))}
    </Form.Dropdown>
  );
}