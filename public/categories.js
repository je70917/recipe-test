"use strict";

/**
 * Restaurant categories. Each OpenStreetMap `cuisine` value listed in `match`
 * maps a place into that category. Places that match nothing fall back to
 * "Fast Food" (if tagged amenity=fast_food) or "Other".
 */
const CATEGORIES = [
  { id: "chinese", label: "Chinese", emoji: "🥟", color: "#d93a3a",
    match: ["chinese", "cantonese", "sichuan", "szechuan", "hunan", "shanghai", "shanghainese",
      "dim_sum", "dumpling", "dumplings", "hot_pot", "hotpot", "taiwanese", "hong_kong", "peking_duck"] },
  { id: "japanese", label: "Japanese", emoji: "🍣", color: "#d6409f",
    match: ["japanese", "sushi", "ramen", "izakaya", "udon", "soba", "teriyaki", "tempura",
      "yakitori", "tonkatsu", "donburi", "japanese_curry", "okonomiyaki"] },
  { id: "korean", label: "Korean", emoji: "🥘", color: "#7c4dcc",
    match: ["korean", "korean_bbq", "bibimbap", "korean_fried_chicken"] },
  { id: "thai", label: "Thai", emoji: "🌶️", color: "#2f9e5b",
    match: ["thai", "isan"] },
  { id: "vietnamese", label: "Vietnamese", emoji: "🍜", color: "#0f9a8f",
    match: ["vietnamese", "pho", "banh_mi"] },
  { id: "indian", label: "Indian", emoji: "🍛", color: "#e8790c",
    match: ["indian", "pakistani", "nepalese", "nepali", "bangladeshi", "sri_lankan", "himalayan",
      "curry", "punjabi", "south_indian", "north_indian", "tandoori"] },
  { id: "asian", label: "Other Asian", emoji: "🥢", color: "#b5651d",
    match: ["asian", "pan_asian", "filipino", "malaysian", "indonesian", "burmese", "singaporean",
      "mongolian", "cambodian", "laotian", "tibetan", "poke", "hawaiian"] },
  { id: "italian", label: "Italian", emoji: "🍝", color: "#3f8f3a",
    match: ["italian", "pasta"] },
  { id: "pizza", label: "Pizza", emoji: "🍕", color: "#d99a00",
    match: ["pizza", "italian_pizza", "pizzeria"] },
  { id: "mexican", label: "Mexican", emoji: "🌮", color: "#c2410c",
    match: ["mexican", "tex_mex", "tacos", "taco", "burrito", "burritos"] },
  { id: "latin", label: "Latin American", emoji: "🫔", color: "#db2777",
    match: ["latin_american", "peruvian", "brazilian", "colombian", "salvadoran", "cuban", "venezuelan",
      "argentinian", "argentine", "caribbean", "puerto_rican", "dominican", "jamaican", "honduran",
      "guatemalan", "ecuadorian", "chilean", "empanada", "arepas"] },
  { id: "mediterranean", label: "Mediterranean", emoji: "🥙", color: "#2563eb",
    match: ["mediterranean", "greek", "lebanese", "turkish", "middle_eastern", "kebab", "falafel",
      "persian", "iranian", "israeli", "moroccan", "afghan", "arab", "syrian", "egyptian", "armenian",
      "shawarma", "gyro", "gyros"] },
  { id: "american", label: "American", emoji: "🍖", color: "#9a4a12",
    match: ["american", "bbq", "barbecue", "steak_house", "steakhouse", "diner", "southern", "cajun",
      "creole", "soul_food", "regional", "comfort_food", "grill", "new_american", "breakfast", "brunch"] },
  { id: "fastfood", label: "Fast Food", emoji: "🍔", color: "#e08a00",
    match: ["burger", "burgers", "chicken", "fried_chicken", "hot_dog", "sandwich", "sandwiches",
      "wings", "chicken_wings", "fries", "subs", "fast_food"] },
  { id: "seafood", label: "Seafood", emoji: "🦐", color: "#0284c7",
    match: ["seafood", "fish", "fish_and_chips", "oyster", "crab", "lobster"] },
  { id: "european", label: "European", emoji: "🥐", color: "#4f46e5",
    match: ["french", "spanish", "tapas", "german", "british", "irish", "polish", "russian",
      "ukrainian", "portuguese", "european", "belgian", "austrian", "swiss", "hungarian",
      "scandinavian", "georgian", "czech", "balkan"] },
  { id: "african", label: "African", emoji: "🍲", color: "#a16207",
    match: ["african", "ethiopian", "eritrean", "nigerian", "somali", "senegalese", "west_african",
      "ghanaian", "kenyan"] },
  { id: "other", label: "Other", emoji: "🍽️", color: "#6b7280", match: [] },
];

const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const CUISINE_TO_CATEGORY = new Map();
for (const c of CATEGORIES) for (const m of c.match) CUISINE_TO_CATEGORY.set(m, c.id);

/** Split an OSM cuisine tag ("sushi;ramen", "Tex-Mex") into normalized values. */
function parseCuisines(tag) {
  return String(tag || "")
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim().replace(/[\s-]+/g, "_"))
    .filter(Boolean);
}

/**
 * Many places on the map have no cuisine tag. When that happens we guess from the
 * name ("Seoul Garden" -> Korean). Checked in order, so more specific cuisines come
 * first (e.g. "Korean Fried Chicken" is Korean, not Fast Food).
 */
const NAME_HINTS = [
  ["korean", /\b(korean|korea|seoul|busan|k-?bbq|bibimbap|kimchi|bulgogi|galbi|kalbi|gogi|bbq chicken|soondubu|sundubu|tofu house|pocha|hanok|kimbap|gimbap|tteok|hangang)\b/],
  ["japanese", /\b(japanese|sushi|ramen|izakaya|teriyaki|hibachi|udon|tokyo|osaka|katsu|yakitori|bento|omakase|teppanyaki)\b/],
  ["vietnamese", /\b(pho|vietnamese|saigon|hanoi|banh mi)\b/],
  ["thai", /\b(thai|bangkok|siam|pad thai)\b/],
  ["chinese", /\b(chinese|china|szechuan|sichuan|hunan|canton|cantonese|mandarin|peking|beijing|shanghai|dim sum|dumplings?|wok|dragon|panda|hot pot|noodle house)\b/],
  ["indian", /\b(indian|india|tandoori?|masala|tikka|biryani|bombay|mumbai|delhi|punjab[i]?|himalayan|nepal[i]?|curry house)\b/],
  ["pizza", /\b(pizza|pizzeria)\b/],
  ["italian", /\b(italian|trattoria|ristorante|osteria|pasta|spaghetti)\b/],
  ["mexican", /\b(mexican|mexico|taco|tacos|taqueria|burrito|cantina|tex-?mex)\b/],
  ["mediterranean", /\b(mediterranean|greek|lebanese|turkish|gyros?|kebabs?|kabobs?|shawarma|falafel)\b/],
  ["seafood", /\b(seafood|crab|lobster|oysters?|fish market)\b/],
  ["american", /\b(bbq|barbecue|smokehouse|steakhouse|diner)\b/],
  ["fastfood", /\b(burgers?|wings|fried chicken|hot dogs?)\b/],
];

function categoryFromName(name) {
  const n = String(name || "").toLowerCase();
  for (const [id, re] of NAME_HINTS) if (re.test(n)) return id;
  return null;
}

/** Decide which category an OSM place belongs to: cuisine tag, then name, then fallback. */
function categorize(tags) {
  for (const c of parseCuisines(tags.cuisine)) {
    const id = CUISINE_TO_CATEGORY.get(c);
    if (id) return id;
  }
  return categoryFromName(tags.name) || (tags.amenity === "fast_food" ? "fastfood" : "other");
}

if (typeof module !== "undefined") {
  module.exports = { CATEGORIES, CATEGORY_BY_ID, parseCuisines, categorize, categoryFromName };
}
