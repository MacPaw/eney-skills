import { runJXA } from "./run-script.js";

export interface Contact {
  name: string;
  phones: string[];
  emails: string[];
}

// Strip all non-digit characters for fuzzy phone matching
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

// Two phone numbers match if one's digits end with the last 9 digits of the other
function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  const len = Math.min(da.length, db.length, 9);
  return da.slice(-len) === db.slice(-len);
}

export async function resolveContactNames(
  identifiers: string[],
): Promise<Map<string, string>> {
  if (identifiers.length === 0) return new Map();

  const all = await searchContacts("");
  const map = new Map<string, string>();

  for (const contact of all) {
    for (const id of identifiers) {
      if (map.has(id)) continue;
      for (const phone of contact.phones) {
        if (phonesMatch(phone, id)) {
          map.set(id, contact.name);
          break;
        }
      }
      for (const email of contact.emails) {
        if (email === id) {
          map.set(id, contact.name);
          break;
        }
      }
    }
  }

  return map;
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const lowerQuery = query.toLowerCase();
  const script = `
    ObjC.import("Contacts");
    const store = $.CNContactStore.alloc.init;
    const keysToFetch = ObjC.wrap([
      $.CNContactGivenNameKey,
      $.CNContactFamilyNameKey,
      $.CNContactPhoneNumbersKey,
      $.CNContactEmailAddressesKey,
    ]);
    const request = $.CNContactFetchRequest.alloc.initWithKeysToFetch(keysToFetch);
    const results = [];
    const filter = ${query === "" ? "null" : JSON.stringify(lowerQuery)};
    store.enumerateContactsWithFetchRequestErrorUsingBlock(request, null, (contact, stop) => {
      const firstName = ObjC.unwrap(contact.givenName) || "";
      const lastName = ObjC.unwrap(contact.familyName) || "";
      const name = (firstName + " " + lastName).trim() || "Unknown";
      if (filter && !name.toLowerCase().includes(filter)) return;
      const phones = ObjC.unwrap(contact.phoneNumbers).map(p => ObjC.unwrap(p.value.stringValue));
      const emails = ObjC.unwrap(contact.emailAddresses).map(e => ObjC.unwrap(e.value));
      results.push({ name, phones, emails });
    });
    JSON.stringify(results);
  `;

  const result = await runJXA(script);
  return JSON.parse(result) as Contact[];
}
