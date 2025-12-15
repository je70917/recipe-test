// Recipe database
const recipes = [
  {
    name: "Pasta Carbonara",
    image:
      "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800&q=80",
    ingredients: [
      "200g spaghetti",
      "100g pancetta",
      "2 large eggs",
      "50g pecorino cheese",
      "50g parmesan",
      "Black pepper",
      "Salt",
    ],
    instructions:
      "1. Cook pasta al dente.\n2. Fry pancetta until crispy.\n3. Mix eggs and grated cheeses.\n4. Toss hot pasta with pancetta, then mix in egg and cheese mixture.\n5. Season with black pepper and serve immediately.",
    prepTime: "15 mins",
    cookTime: "15 mins",
  },
  {
    name: "Vegetable Stir Fry",
    image:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80",
    ingredients: [
      "2 cups mixed vegetables",
      "200g tofu",
      "2 tbsp soy sauce",
      "1 tbsp sesame oil",
      "2 cloves garlic",
      "1 tsp ginger",
      "Rice",
    ],
    instructions:
      "1. Cook rice according to package.\n2. Heat oil and sauté garlic and ginger.\n3. Add tofu and cook until golden.\n4. Add vegetables and stir-fry until tender-crisp.\n5. Add soy sauce and serve over rice.",
    prepTime: "10 mins",
    cookTime: "15 mins",
  },
  {
    name: "Classic Burger",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    ingredients: [
      "500g ground beef",
      "1 egg",
      "1/2 cup breadcrumbs",
      "1 tsp Worcestershire sauce",
      "Salt & pepper",
      "Burger buns",
      "Lettuce, tomato, cheese",
    ],
    instructions:
      "1. Mix beef, egg, breadcrumbs, and seasonings.\n2. Form into patties.\n3. Grill or fry for 4-5 minutes per side.\n4. Toast buns and assemble with your favorite toppings.",
    prepTime: "15 mins",
    cookTime: "10 mins",
  },
  {
    name: "Chicken Curry",
    image:
      "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800&q=80",
    ingredients: [
      "500g chicken",
      "1 onion",
      "2 cloves garlic",
      "1 tbsp curry powder",
      "400ml coconut milk",
      "1 tbsp oil",
      "Rice",
    ],
    instructions:
      "1. Brown chicken in oil and set aside.\n2. Sauté onion and garlic until soft.\n3. Add curry powder and cook for 1 minute.\n4. Return chicken, add coconut milk, and simmer for 20 minutes.\n5. Serve with rice.",
    prepTime: "15 mins",
    cookTime: "30 mins",
  },
  {
    name: "Caesar Salad",
    image:
      "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&q=80",
    ingredients: [
      "1 romaine lettuce",
      "50g parmesan",
      "1 cup croutons",
      "2 chicken breasts",
      "Caesar dressing",
      "1 egg",
      "1 clove garlic",
    ],
    instructions:
      "1. Grill chicken and slice.\n2. Tear lettuce into bite-sized pieces.\n3. Make dressing with egg, garlic, and parmesan.\n4. Toss everything together with croutons and serve.",
    prepTime: "20 mins",
    cookTime: "15 mins",
  },
];

document.addEventListener("DOMContentLoaded", () => {
  const drawButton = document.getElementById("drawButton");
  const recipePaper = document.getElementById("recipePaper");
  const recipeName = document.getElementById("recipeName");
  const recipeDetails = document.getElementById("recipeDetails");
  const closeButton = document.getElementById("closeButton");
  let isDrawing = false;

  // Function to get a random recipe
  function getRandomRecipe() {
    return recipes[Math.floor(Math.random() * recipes.length)];
  }

  // Function to display recipe
  function displayRecipe(recipe) {
    recipeName.textContent = recipe.name;

    const ingredientsList = recipe.ingredients
      .map((ing) => `• ${ing}`)
      .join("\n");

    recipeDetails.innerHTML = `
            <img src="${recipe.image}" alt="${recipe.name}" class="recipe-image" />
            <div class="recipe-meta">
                <span>⏱️ Prep: ${recipe.prepTime}</span>
                <span>🍳 Cook: ${recipe.cookTime}</span>
            </div>
            <div class="recipe-columns">
                <div class="recipe-column">
                    <h3>Ingredients:</h3>
                    <p class="ingredients">${ingredientsList}</p>
                </div>
                <div class="recipe-column">
                    <h3>Instructions:</h3>
                    <p class="instructions">${recipe.instructions}</p>
                </div>
            </div>
        `;
  }

  // Animate the drawing of a recipe
  function animateDraw() {
    if (isDrawing) return;
    isDrawing = true;

    // Get a new recipe
    const recipe = getRandomRecipe();
    displayRecipe(recipe);

    // Show the recipe paper with animation
    recipePaper.classList.remove("hidden");
    recipePaper.classList.add("animate-draw", "visible");

    // Remove animation class after it completes
    setTimeout(() => {
      recipePaper.classList.remove("animate-draw");
      isDrawing = false;
    }, 800);
  }

  // Function to hide recipe
  function hideRecipe() {
    recipePaper.classList.remove("visible");
    recipePaper.classList.add("hidden");
  }

  // Initialize with hidden recipe
  hideRecipe();

  // Event listeners
  drawButton.addEventListener("click", animateDraw);
  closeButton.addEventListener("click", hideRecipe);

  // Add keyboard support (space/enter to draw, escape to close)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      animateDraw();
    } else if (e.code === "Escape") {
      hideRecipe();
    }
  });
});
