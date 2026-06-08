const photoInput = document.getElementById('photoInput');
const uploadButton = document.getElementById('uploadButton');
const clearPhotoButton = document.getElementById('clearPhotoButton');
const recipeButton = document.getElementById('recipeButton');
const cookingModeButton = document.getElementById('cookingModeButton');
const subscribeButton = document.getElementById('subscribeButton');
const installButton = document.getElementById('installButton');
const recipeOutput = document.getElementById('recipeOutput');
const previewImage = document.getElementById('previewImage');
const previewLabel = document.getElementById('previewLabel');
const ingredientsInput = document.getElementById('ingredientsInput');
const dietSelect = document.getElementById('dietSelect');
const premiumSignal = document.getElementById('premiumSignal');
const statusBadge = document.getElementById('statusBadge');
const recognitionStatus = document.getElementById('recognitionStatus');

let premiumActive = localStorage.getItem('premiumActive') === 'true';
let latestRecipe = null;
let cookingModeVisible = false;
let recognizedIngredients = [];
let deferredPrompt = null;

function saveRecipeState() {
  localStorage.setItem('premiumActive', premiumActive);
  localStorage.setItem('recognizedIngredients', JSON.stringify(recognizedIngredients));
  if (latestRecipe) {
    localStorage.setItem('latestRecipe', JSON.stringify(latestRecipe));
  }
}

function loadRecipeState() {
  const savedRecipe = localStorage.getItem('latestRecipe');
  const savedIngredients = localStorage.getItem('recognizedIngredients');

  if (savedRecipe) {
    try {
      latestRecipe = JSON.parse(savedRecipe);
    } catch (error) {
      latestRecipe = null;
    }
  }

  if (savedIngredients) {
    try {
      recognizedIngredients = JSON.parse(savedIngredients);
    } catch (error) {
      recognizedIngredients = [];
    }
  }
}

function setRecognitionStatus(message, isError = false) {
  recognitionStatus.textContent = message;
  recognitionStatus.style.color = isError ? '#fca5a5' : '#cbd5e1';
}

function updateSubscriptionUI() {
  subscribeButton.textContent = premiumActive ? 'Premium active' : 'Start free trial';
  subscribeButton.classList.toggle('primary', !premiumActive);
  subscribeButton.classList.toggle('secondary', premiumActive);
  premiumSignal.textContent = premiumActive
    ? 'Premium unlocked: grocery lists, meal plans, and calorie guidance enabled.'
    : 'Premium is inactive. Upgrade to unlock full planner features.';
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  statusBadge.textContent = online ? 'Online' : 'Offline';
  statusBadge.classList.toggle('online', online);
  statusBadge.classList.toggle('offline', !online);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showImagePreview(file) {
  const reader = new FileReader();
  reader.onload = () => {
    previewImage.src = reader.result;
    previewImage.alt = file.name;
    previewImage.style.display = 'block';
    previewLabel.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function extractIngredients() {
  const typed = ingredientsInput.value.trim();
  if (typed) {
    return typed.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return recognizedIngredients;
}

function createRecipe(ingredients, diet) {
  const baseTitle = 'Fridge Chef Special';
  const prep = [
    'Wash and prep your ingredients.',
    'Chop veggies into bite-sized pieces.',
    'Heat a pan over medium heat with olive oil.',
  ];

  const dietAdvice = [];
  if (diet === 'keto') {
    dietAdvice.push('Skip starchy carbs and add butter or avocado for healthy fats.');
  } else if (diet === 'vegan') {
    dietAdvice.push('Use plant-based protein and finish with lemon juice for brightness.');
  } else if (diet === 'gluten-free') {
    dietAdvice.push('Use gluten-free grains or pasta if needed, and spice to taste.');
  } else {
    dietAdvice.push('Combine ingredients for a balanced, satisfying meal.');
  }

  const steps = [
    ...prep,
    ...dietAdvice,
    'Sauté vegetables until bright and tender.',
    'Layer proteins and grains, then simmer gently.',
    'Serve warm with fresh herbs or a squeeze of citrus.',
  ];

  const ingredientList = ingredients.length > 0
    ? ingredients.map((item) => `• ${item}`).join('\n')
    : '• No ingredients found. Add a photo or type ingredients manually.';

  const recipeTitle = `${diet === 'vegan' ? 'Vegan' : diet === 'keto' ? 'Keto' : diet === 'gluten-free' ? 'Gluten-free' : 'Balanced'} ${baseTitle}`;
  const calories = diet === 'keto'
    ? `Approx. 520 kcal\n- Protein: 37g\n- Fat: 32g\n- Carbs: 18g`
    : diet === 'vegan'
    ? `Approx. 460 kcal\n- Protein: 18g\n- Fat: 20g\n- Carbs: 53g`
    : `Approx. 510 kcal\n- Protein: 29g\n- Fat: 22g\n- Carbs: 42g`;

  return {
    title: recipeTitle,
    summary: `A quick meal built from ${ingredients.length || 3} ingredients and tailored for ${diet.replace('-', ' ')} preferences.`,
    ingredients: ingredientList,
    steps,
    grocery: ingredients.length > 0 ? ingredients.map((item) => `${item} — 1 portion`).join('\n') : 'No grocery list available yet.',
    calories,
  };
}

function renderRecipe(recipe) {
  recipeOutput.innerHTML = `
    <h4>${recipe.title}</h4>
    <p>${recipe.summary}</p>
    <div class="recipe-panel">
      <div>
        <h5>Ingredients</h5>
        <pre>${recipe.ingredients}</pre>
      </div>
      <div>
        <h5>Nutrition</h5>
        <pre>${recipe.calories}</pre>
      </div>
    </div>
    <div class="recipe-panel">
      <div>
        <h5>Instructions</h5>
        <ol>${recipe.steps.map((step) => `<li>${step}</li>`).join('')}</ol>
      </div>
      <div class="premium-note">
        <h5>Grocery list</h5>
        <pre>${premiumActive ? recipe.grocery : 'Activate premium to generate grocery lists and meal plans.'}</pre>
      </div>
    </div>
  `;
}

function renderCookingMode() {
  if (!latestRecipe) {
    recipeOutput.innerHTML = '<p>Please generate a recipe before opening cooking mode.</p>';
    return;
  }

  const cookingSteps = latestRecipe.steps.map((step, index) => `
      <li>
        <span class="step-label">Step ${index + 1}</span>
        <div>${step}</div>
      </li>
    `).join('');

  recipeOutput.innerHTML = `
      <h4>${latestRecipe.title} — Cooking Mode</h4>
      <ul class="cooking-mode-list">${cookingSteps}</ul>
      <p class="cooking-tip">Tip: Keep your ingredients ready and follow each step at your own pace.</p>
  `;
}

async function recognizeIngredients(file) {
  setRecognitionStatus('Recognizing ingredients from your photo...');
  try {
    const imageData = await readFileAsDataURL(file);
    const response = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData }),
    });

    if (!response.ok) {
      throw new Error('Recognition API failed');
    }

    const data = await response.json();
    recognizedIngredients = Array.isArray(data.ingredients) ? data.ingredients : [];

    if (recognizedIngredients.length > 0) {
      ingredientsInput.value = recognizedIngredients.join(', ');
      setRecognitionStatus(`Detected ingredients: ${recognizedIngredients.join(', ')}`);
    } else {
      setRecognitionStatus('Could not detect ingredients clearly. Add them manually if needed.', true);
    }

    saveRecipeState();
  } catch (error) {
    console.warn(error);
    setRecognitionStatus('Could not recognize ingredients from the photo. Please add them manually.', true);
  }
}

async function handleGenerateRecipe() {
  recipeButton.disabled = true;
  recipeButton.textContent = 'Generating recipe...';

  try {
    let ingredients = extractIngredients();
    if (ingredients.length === 0 && photoInput.files.length > 0) {
      await recognizeIngredients(photoInput.files[0]);
      ingredients = extractIngredients();
    }

    if (ingredients.length === 0) {
      ingredients = ['eggs', 'cheese', 'mixed greens'];
    }

    const requestBody = {
      ingredients,
      diet: dietSelect.value,
      imageData: photoInput.files.length > 0 ? await readFileAsDataURL(photoInput.files[0]) : null,
    };

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error('Recipe API failed');
    }

    const payload = await response.json();
    latestRecipe = payload.recipe || createRecipe(ingredients, dietSelect.value);

    if (Array.isArray(payload.ingredients) && payload.ingredients.length > 0) {
      recognizedIngredients = payload.ingredients;
      ingredientsInput.value = recognizedIngredients.join(', ');
    }

    saveRecipeState();
    renderRecipe(latestRecipe);
    setRecognitionStatus(payload.message || 'Recipe generated successfully.');
  } catch (error) {
    console.warn(error);
    latestRecipe = createRecipe(extractIngredients(), dietSelect.value);
    renderRecipe(latestRecipe);
    setRecognitionStatus('Unable to fetch a recipe from the AI API. Using a local fallback.', true);
  }

  recipeButton.disabled = false;
  recipeButton.textContent = 'Generate recipe';
}

function handleCookingMode() {
  cookingModeVisible = !cookingModeVisible;
  cookingModeButton.textContent = cookingModeVisible ? 'Hide cooking mode' : 'Show cooking mode';
  if (cookingModeVisible) {
    renderCookingMode();
  } else if (latestRecipe) {
    renderRecipe(latestRecipe);
  }
}

function handleSubscription() {
  premiumActive = !premiumActive;
  localStorage.setItem('premiumActive', premiumActive);
  updateSubscriptionUI();
  saveRecipeState();
  if (latestRecipe) {
    renderRecipe(latestRecipe);
  }
}

function clearPhoto() {
  photoInput.value = '';
  previewImage.src = '';
  previewImage.style.display = 'none';
  previewLabel.style.display = 'block';
  recognizedIngredients = [];
  ingredientsInput.value = '';
  clearPhotoButton.classList.add('hidden');
  setRecognitionStatus('Photo cleared. Snap a new photo or add ingredients manually.');
  saveRecipeState();
}

uploadButton.addEventListener('click', () => photoInput.click());
clearPhotoButton.addEventListener('click', clearPhoto);
photoInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  showImagePreview(file);
  clearPhotoButton.classList.remove('hidden');
  await recognizeIngredients(file);
});
recipeButton.addEventListener('click', handleGenerateRecipe);
cookingModeButton.addEventListener('click', handleCookingMode);
subscribeButton.addEventListener('click', handleSubscription);
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  installButton.classList.add('hidden');
  deferredPrompt = null;
  setRecognitionStatus(choice.outcome === 'accepted' ? 'App install accepted.' : 'App install dismissed.');
});
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  installButton.classList.add('hidden');
  setRecognitionStatus('App installed successfully.');
});

loadRecipeState();
updateSubscriptionUI();
updateNetworkStatus();

if (latestRecipe) {
  renderRecipe(latestRecipe);
}

setRecognitionStatus('Upload a fridge photo to auto-detect ingredients or type them manually.');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
