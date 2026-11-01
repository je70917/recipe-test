const test = require("node:test");
const assert = require("node:assert");
const { categorize, parseCuisines, CATEGORIES } = require("../public/categories.js");

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
