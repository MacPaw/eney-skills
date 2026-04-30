import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  countryCode: z.string().optional().describe("ISO 3166-1 alpha-2 country code (e.g. 'US', 'GB', 'UA')."),
  year: z.number().int().optional().describe("Calendar year. Defaults to the current year."),
});

type Props = z.infer<typeof schema>;

interface Country {
  countryCode: string;
  name: string;
}

interface Holiday {
  date: string;
  localName: string;
  name: string;
  global: boolean;
  counties: string[] | null;
}

interface RawHoliday {
  date?: string;
  localName?: string;
  name?: string;
  global?: boolean;
  counties?: string[] | null;
}

async function fetchCountries(): Promise<Country[]> {
  const res = await fetch("https://date.nager.at/api/v3/AvailableCountries");
  if (!res.ok) throw new Error(`Country API returned ${res.status}`);
  const list = (await res.json()) as Country[];
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchHolidays(year: number, countryCode: string): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(countryCode)}`);
  if (!res.ok) throw new Error(`Holidays API returned ${res.status}`);
  const list = (await res.json()) as RawHoliday[];
  return list.map((h) => ({
    date: h.date ?? "",
    localName: h.localName ?? "",
    name: h.name ?? "",
    global: h.global ?? true,
    counties: h.counties ?? null,
  }));
}

function detectDefaultCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.startsWith("America/")) return "US";
    if (tz === "Europe/London") return "GB";
    if (tz === "Europe/Kyiv" || tz === "Europe/Kiev") return "UA";
    if (tz.startsWith("Europe/")) return "DE";
    if (tz.startsWith("Asia/Tokyo")) return "JP";
  } catch {
    // ignore
  }
  return "US";
}

function ListHolidays(props: Props) {
  const closeWidget = useCloseWidget();
  const currentYear = new Date().getFullYear();
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryCode] = useState(props.countryCode ?? detectDefaultCountry());
  const [year, setYear] = useState<number | null>(props.year ?? currentYear);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCountries()
      .then(setCountries)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingCountries(false));
  }, []);

  useEffect(() => {
    if (!countryCode || !year) return;
    setIsLoadingHolidays(true);
    setError("");
    setHolidays(null);
    fetchHolidays(year, countryCode)
      .then(setHolidays)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setIsLoadingHolidays(false));
  }, [countryCode, year]);

  function onDone() {
    if (!holidays) closeWidget("No holidays loaded.");
    else closeWidget(`${holidays.length} holiday(s) for ${countryCode} in ${year}.`);
  }

  const country = countries.find((c) => c.countryCode === countryCode);
  const header = <CardHeader title="Public Holidays" iconBundleId="com.apple.iCal" />;

  if (isLoadingCountries) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Loading countries..." />
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action title="Done" onAction={onDone} style="primary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown name="countryCode" label="Country" value={countryCode} onChange={setCountryCode} searchable>
        {countries.map((c) => (
          <Form.Dropdown.Item key={c.countryCode} title={`${c.name} (${c.countryCode})`} value={c.countryCode} />
        ))}
      </Form.Dropdown>
      <Form.NumberField name="year" label="Year" value={year} onChange={setYear} min={1900} max={currentYear + 50} />
      {isLoadingHolidays && <Paper markdown="Loading holidays..." />}
      {!isLoadingHolidays && holidays && holidays.length === 0 && (
        <Paper markdown={`_No holidays found for ${countryCode} in ${year}._`} />
      )}
      {!isLoadingHolidays && holidays && holidays.length > 0 && (
        <Paper
          markdown={[
            `### ${country?.name ?? countryCode} — ${year}`,
            "",
            "| Date | Holiday | Local name | Scope |",
            "|---|---|---|---|",
            ...holidays.map((h) => {
              const scope = h.global ? "national" : h.counties && h.counties.length ? `regional: ${h.counties.join(", ")}` : "regional";
              return `| \`${h.date}\` | ${h.name} | _${h.localName}_ | ${scope} |`;
            }),
          ].join("\n")}
        />
      )}
    </Form>
  );
}

const ListHolidaysWidget = defineWidget({
  name: "list-holidays",
  description:
    "List public holidays for a country and year using the free Nager.Date API. Country dropdown is populated from the API; year defaults to the current year. Each row shows the date, English name, local-language name, and whether the holiday is national or regional.",
  schema,
  component: ListHolidays,
});

export default ListHolidaysWidget;
