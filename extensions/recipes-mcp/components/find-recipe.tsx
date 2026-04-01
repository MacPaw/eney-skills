import { useState, useEffect } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
} from "@eney/api";

const schema = z.object({
  query: z.string().optional().describe("The recipe or dish name to search for."),
});

type Props = z.infer<typeof schema>;

interface Meal {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  [key: string]: string | null;
}

function parseIngredients(meal: Meal): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ingredient && ingredient.trim()) {
      const line = measure && measure.trim()
        ? `${measure.trim()} — ${ingredient.trim()}`
        : ingredient.trim();
      ingredients.push(line);
    }
  }
  return ingredients;
}

function formatRecipe(meal: Meal): string {
  const ingredients = parseIngredients(meal);
  const steps = meal.strInstructions
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let md = `## ${meal.strMeal}\n\n`;
  md += `**Cuisine:** ${meal.strArea} · **Category:** ${meal.strCategory}\n\n`;
  md += `![${meal.strMeal}](${meal.strMealThumb}/preview)\n\n`;
  md += `### Ingredients\n\n`;
  md += ingredients.map((ing) => `- ${ing}`).join("\n");
  md += `\n\n### Instructions\n\n`;
  md += steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
  return md;
}

interface SearchResult {
  idMeal: string;
  strMeal: string;
}

const POPULAR_CATEGORIES = ["Chicken", "Beef", "Pasta", "Seafood", "Dessert", "Vegetarian"];

function FindRecipe(props: Props) {
  const closeWidget = useCloseWidget();
  const [query, setQuery] = useState(props.query ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [recipe, setRecipe] = useState("");
  const [category, setCategory] = useState(POPULAR_CATEGORIES[0]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadCategory(category);
  }, []);

  async function loadCategory(cat: string) {
    setIsLoading(true);
    setError("");
    setRecipe("");
    setResults([]);
    setSelectedId("");
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(cat)}`
      );
      const data = await res.json();
      if (!data.meals || data.meals.length === 0) {
        setError(`No recipes found in "${cat}".`);
        return;
      }
      const meals: SearchResult[] = data.meals.map((m: { idMeal: string; strMeal: string }) => ({
        idMeal: m.idMeal,
        strMeal: m.strMeal,
      }));
      setResults(meals);
      setSelectedId(meals[0].idMeal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onSearch() {
    if (!query.trim()) return;
    setIsLoading(true);
    setError("");
    setRecipe("");
    setResults([]);
    setSelectedId("");
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();
      if (!data.meals || data.meals.length === 0) {
        setError(`No recipes found for "${query.trim()}".`);
        return;
      }
      const meals: SearchResult[] = data.meals.map((m: Meal) => ({
        idMeal: m.idMeal,
        strMeal: m.strMeal,
      }));
      setResults(meals);
      setSelectedId(meals[0].idMeal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  async function onViewRecipe() {
    if (!selectedId) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${selectedId}`
      );
      const data = await res.json();
      if (!data.meals || data.meals.length === 0) {
        setError("Could not load recipe details.");
        return;
      }
      setRecipe(formatRecipe(data.meals[0]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onCategoryChange(value: string) {
    setCategory(value);
    loadCategory(value);
  }

  // Recipe detail view
  if (recipe) {
    return (
      <Form
        header={<CardHeader title="Recipe" iconBundleId="com.apple.Safari" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="Back"
              onSubmit={() => setRecipe("")}
              style="secondary"
            />
            <Action title="Done" onAction={() => closeWidget("Done.")} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={recipe} />
      </Form>
    );
  }

  // Search mode
  if (showSearch) {
    return (
      <Form
        header={<CardHeader title="Search Recipes" iconBundleId="com.apple.Safari" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="Browse"
              onSubmit={() => { setShowSearch(false); loadCategory(category); }}
              style="secondary"
            />
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
        <Form.TextField
          name="query"
          label="Search recipes"
          value={query}
          onChange={setQuery}
        />
        {results.length > 0 && (
          <Form.Dropdown
            name="recipe"
            label="Results"
            value={selectedId}
            onChange={setSelectedId}
          >
            {results.map((r) => (
              <Form.Dropdown.Item key={r.idMeal} value={r.idMeal} title={r.strMeal} />
            ))}
          </Form.Dropdown>
        )}
        {results.length > 0 && (
          <ActionPanel>
            <Action.SubmitForm
              title={isLoading ? "Loading..." : "View Recipe"}
              onSubmit={onViewRecipe}
              style="primary"
              isLoading={isLoading}
              isDisabled={!selectedId}
            />
          </ActionPanel>
        )}
      </Form>
    );
  }

  // Browse by category (default view)
  return (
    <Form
      header={<CardHeader title="Recipes" iconBundleId="com.apple.Safari" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm
            title="Search"
            onSubmit={() => setShowSearch(true)}
            style="secondary"
          />
          <Action.SubmitForm
            title={isLoading ? "Loading..." : "View Recipe"}
            onSubmit={onViewRecipe}
            style="primary"
            isLoading={isLoading}
            isDisabled={!selectedId}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.Dropdown
        name="category"
        label="Category"
        value={category}
        onChange={onCategoryChange}
      >
        {POPULAR_CATEGORIES.map((cat) => (
          <Form.Dropdown.Item key={cat} value={cat} title={cat} />
        ))}
      </Form.Dropdown>
      {results.length > 0 && (
        <Form.Dropdown
          name="recipe"
          label="Recipe"
          value={selectedId}
          onChange={setSelectedId}
        >
          {results.map((r) => (
            <Form.Dropdown.Item key={r.idMeal} value={r.idMeal} title={r.strMeal} />
          ))}
        </Form.Dropdown>
      )}
    </Form>
  );
}

const FindRecipeWidget = defineWidget({
  name: "find-recipe",
  description: "Search for recipes and view ingredients with step-by-step cooking instructions",
  schema,
  component: FindRecipe,
});

export default FindRecipeWidget;
