const test = require("node:test");
const assert = require("node:assert");
const { categorize, categoryFromName, parseCuisines, CATEGORIES } = require("../public/categories.js");

test("parses multi-value and mixed-case cuisine tags", () => {
  assert.deepStrictEqual(parseCuisines("Sushi; Ramen"), ["sushi", "ramen"]);
  assert.deepStrictEqual(parseCuisines("Tex-Mex"), ["tex_mex"]);
  assert.deepStrictEqual(parseCuisines(undefined), []);
});

test("maps cuisines to cultural categories", () => {
  const cases = {
    chinese: "chinese", "dim_sum;cantonese": "chinese", sushi: "japanese", korean_bbq: "korean",
    thai: "thai", pho: "vietnamese", indian: "indian", italian: "italian", pizza: "pizza",
    "tex-mex": "mexican", peruvian: "latin", greek: "mediterranean", bbq: "american",
    burger: "fastfood", seafood: "seafood", french: "european", ethiopian: "african",
  };
  for (const [cuisine, expected] of Object.entries(cases)) {
    assert.strictEqual(categorize({ amenity: "restaurant", cuisine }), expected, cuisine);
  }
});

test("first recognised cuisine wins", () => {
  assert.strictEqual(categorize({ cuisine: "vegan;thai;chinese" }), "thai");
});

test("guesses category from the name when there is no usable cuisine tag", () => {
  const cases = {
    "Seoul Garden": "korean", "Kimchi House": "korean", "Korean Fried Chicken": "korean", "BBQ Chicken": "korean",
    "Lu's Dragon Express": "chinese", "Sakura Sushi": "japanese", "Pho 88": "vietnamese", "Bangkok Basil": "thai",
    "Taqueria El Sol": "mexican", "Tony's Pizza": "pizza", "Joe's Smokehouse": "american",
  };
  for (const [name, expected] of Object.entries(cases)) {
    assert.strictEqual(categorize({ amenity: "restaurant", name }), expected, name);
  }
  assert.strictEqual(categoryFromName("Golden Corral"), null);
  assert.strictEqual(categoryFromName("The Grill Room"), null);
});

test("a recognised cuisine tag beats the name", () => {
  assert.strictEqual(categorize({ amenity: "restaurant", name: "Tokyo Joe's", cuisine: "american" }), "american");
  assert.strictEqual(categorize({ amenity: "restaurant", name: "Seoul Taco", cuisine: "vegan" }), "korean");
});

test("falls back to fast food or other", () => {
  assert.strictEqual(categorize({ amenity: "fast_food" }), "fastfood");
  assert.strictEqual(categorize({ amenity: "fast_food", cuisine: "chinese" }), "chinese");
  assert.strictEqual(categorize({ amenity: "restaurant", cuisine: "vegan" }), "other");
  assert.strictEqual(categorize({ amenity: "restaurant" }), "other");
});

test("no cuisine is claimed by two categories", () => {
  const seen = new Map();
  for (const c of CATEGORIES) for (const m of c.match) {
    assert.ok(!seen.has(m), `${m} in both ${seen.get(m)} and ${c.id}`);
    seen.set(m, c.id);
  }
});
