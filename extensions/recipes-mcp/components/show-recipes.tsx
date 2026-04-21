import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional recipe name or keyword to search for on first open."),
});

type Props = z.infer<typeof schema>;

type MealSummary = {
  idMeal: string;
  strMeal: string;
};

type Meal = MealSummary & {
  strCategory?: string | null;
  strArea?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  strYoutube?: string | null;
  strSource?: string | null;
  [key: string]: string | null | undefined;
};

async function searchMeals(query: string): Promise<Meal[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  const data = (await response.json()) as { meals: Meal[] | null };
  return data.meals ?? [];
}

async function lookupMeal(id: string): Promise<Meal | null> {
  const url = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lookup failed (${response.status})`);
  const data = (await response.json()) as { meals: Meal[] | null };
  return data.meals?.[0] ?? null;
}

function collectIngredients(meal: Meal): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] ?? "")?.toString().trim();
    const measure = (meal[`strMeasure${i}`] ?? "")?.toString().trim();
    if (name) {
      ingredients.push(measure ? `- ${measure} ${name}` : `- ${name}`);
    }
  }
  return ingredients;
}

function formatSteps(instructions: string): string {
  const cleaned = instructions.replace(/\r\n/g, "\n").trim();
  const parts = cleaned
    .split(/\n+|(?<=[.!?])\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return cleaned;
  return parts.map((line, idx) => `${idx + 1}. ${line}`).join("\n");
}

function buildRecipeMarkdown(meal: Meal): string {
  const title = `# ${meal.strMeal}`;
  const tags: string[] = [];
  if (meal.strCategory) tags.push(`**Category:** ${meal.strCategory}`);
  if (meal.strArea) tags.push(`**Cuisine:** ${meal.strArea}`);
  const tagLine = tags.join(" • ");

  const image = meal.strMealThumb ? `![${meal.strMeal}](${meal.strMealThumb})` : "";

  const ingredients = collectIngredients(meal);
  const ingredientsBlock = ingredients.length
    ? `## Ingredients\n${ingredients.join("\n")}`
    : "";

  const steps = meal.strInstructions ? formatSteps(meal.strInstructions) : "";
  const stepsBlock = steps ? `## Steps\n${steps}` : "";

  const links: string[] = [];
  if (meal.strYoutube) links.push(`[Watch on YouTube](${meal.strYoutube})`);
  if (meal.strSource) links.push(`[Source](${meal.strSource})`);
  const linksBlock = links.length ? links.join(" • ") : "";

  return [title, tagLine, image, ingredientsBlock, stepsBlock, linksBlock]
    .filter(Boolean)
    .join("\n\n");
}

type View = "search" | "results" | "detail";

function ShowRecipes(props: Props) {
  const closeWidget = useCloseWidget();
  const [view, setView] = useState<View>("search");
  const [query, setQuery] = useState(props.query ?? "");
  const [results, setResults] = useState<MealSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError("");
    try {
      const meals = await searchMeals(trimmed);
      if (meals.length === 0) {
        setError(`No recipes found for "${trimmed}". Try another keyword.`);
        setResults([]);
        return;
      }
      setResults(meals);
      setSelectedId(meals[0].idMeal);
      setView("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onPickRecipe() {
    if (!selectedId) return;
    const cached = results.find((r) => r.idMeal === selectedId) as Meal | undefined;
    if (cached?.strInstructions) {
      setSelectedMeal(cached);
      setView("detail");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const meal = await lookupMeal(selectedId);
      if (!meal) {
        setError("Could not load recipe details.");
        return;
      }
      setSelectedMeal(meal);
      setView("detail");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onBackToResults() {
    setSelectedMeal(null);
    setView("results");
  }

  function onBackToSearch() {
    setResults([]);
    setSelectedId("");
    setSelectedMeal(null);
    setError("");
    setView("search");
  }

  function onDone() {
    closeWidget("Closed recipe viewer.");
  }

  if (view === "detail" && selectedMeal) {
    return (
      <Form
        size="large"
        header={<CardHeader title={selectedMeal.strMeal} iconBundleId="com.apple.iBooksX" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="Back to Results"
              onSubmit={onBackToResults}
              style="secondary"
            />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={buildRecipeMarkdown(selectedMeal)} />
      </Form>
    );
  }

  if (view === "results") {
    return (
      <Form
        size="large"
        header={<CardHeader title={`Results for "${query}"`} iconBundleId="com.apple.iBooksX" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="New Search"
              onSubmit={onBackToSearch}
              style="secondary"
            />
            <Action.SubmitForm
              title={isLoading ? "Loading..." : "View Recipe"}
              onSubmit={onPickRecipe}
              style="primary"
              isLoading={isLoading}
              isDisabled={!selectedId}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper markdown={`Found **${results.length}** recipe${results.length === 1 ? "" : "s"}. Pick one to see the cooking steps.`} />
        <Form.Dropdown
          name="recipe"
          label="Recipe"
          value={selectedId}
          onChange={setSelectedId}
          searchable
        >
          {results.map((meal) => (
            <Form.Dropdown.Item
              key={meal.idMeal}
              value={meal.idMeal}
              title={meal.strMeal}
            />
          ))}
        </Form.Dropdown>
      </Form>
    );
  }

  return (
    <Form
      size="large"
      header={<CardHeader title="Recipes" iconBundleId="com.apple.iBooksX" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Searching..." : "Search"}
            onSubmit={onSearch}
            style="primary"
            isLoading={isLoading}
            isDisabled={!query.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown="Search recipes by name or keyword (e.g. *chicken*, *pasta*, *arrabiata*). Powered by TheMealDB." />
      <Form.TextField
        name="query"
        label="Search"
        value={query}
        onChange={setQuery}
      />
    </Form>
  );
}

const ShowRecipesWidget = defineWidget({
  name: "show-recipes",
  description:
    "Search recipes by keyword, browse results, and view step-by-step cooking instructions.",
  schema,
  component: ShowRecipes,
});

export default ShowRecipesWidget;
