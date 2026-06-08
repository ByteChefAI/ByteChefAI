require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const port = Number(process.env.PORT) || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'groq-4o-mini';
const GROQ_API_URL = process.env.GROQ_API_URL || `https://api.groq.ai/v1/models/${GROQ_MODEL}/outputs`;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, '/')));

function parseGroqResponse(result) {
  if (!result) {
    return null;
  }

  if (typeof result.output_text === 'string') {
    return result.output_text;
  }

  if (typeof result.text === 'string') {
    return result.text;
  }

  const outputs = result.output || result.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (typeof item === 'string') {
        return item;
      }
      if (item?.content) {
        const content = item.content;
        if (Array.isArray(content)) {
          const found = content.find((block) => block?.type === 'output_text' && typeof block?.text === 'string');
          if (found) {
            return found.text;
          }
        }
      }
    }
  }

  if (Array.isArray(result?.output?.[0]?.content)) {
    const found = result.output[0].content.find((block) => block.type === 'output_text' && typeof block.text === 'string');
    if (found) {
      return found.text;
    }
  }

  return null;
}

async function callGroqAPI(prompt, imageData) {
  if (!GROQ_API_KEY) {
    throw new Error('Missing GROQ_API_KEY');
  }

  const content = [{ type: 'input_text', text: prompt }];
  if (imageData) {
    content.push({ type: 'input_image', image_url: imageData });
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [{ role: 'user', content }] }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API responded with ${response.status}: ${text}`);
  }

  return response.json();
}

function safeParseJSON(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const jsonText = text.slice(start, end + 1);
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function fallbackRecipe(ingredients, diet) {
  const recipeTitle = `${diet === 'vegan' ? 'Vegan' : diet === 'keto' ? 'Keto' : diet === 'gluten-free' ? 'Gluten-free' : 'Balanced'} Fridge Chef Special`;
  const steps = [
    'Wash and prep your ingredients.',
    'Chop veggies into bite-sized pieces.',
    'Heat a pan over medium heat with olive oil.',
    diet === 'keto'
      ? 'Skip starchy carbs and add butter or avocado for healthy fats.'
      : diet === 'vegan'
      ? 'Use plant-based protein and finish with lemon juice for brightness.'
      : diet === 'gluten-free'
      ? 'Use gluten-free grains or pasta if needed, and spice to taste.'
      : 'Combine ingredients for a balanced, satisfying meal.',
    'Sauté vegetables until bright and tender.',
    'Layer proteins and grains, then simmer gently.',
    'Serve warm with fresh herbs or a squeeze of citrus.',
  ];

  return {
    title: recipeTitle,
    summary: `A quick meal built from ${ingredients.length || 3} ingredients and tailored for ${diet.replace('-', ' ')} preferences.`,
    ingredients: ingredients.length > 0 ? ingredients.map((item) => `• ${item}`).join('\n') : '• No ingredients detected. Add them manually.',
    steps,
    grocery: ingredients.length > 0 ? ingredients.map((item) => `${item} — 1 portion`).join('\n') : 'No grocery list available yet.',
    calories:
      diet === 'keto'
        ? 'Approx. 520 kcal\n- Protein: 37g\n- Fat: 32g\n- Carbs: 18g'
        : diet === 'vegan'
        ? 'Approx. 460 kcal\n- Protein: 18g\n- Fat: 20g\n- Carbs: 53g'
        : 'Approx. 510 kcal\n- Protein: 29g\n- Fat: 22g\n- Carbs: 42g',
  };
}

function normalizeIngredients(text) {
  if (!text) {
    return [];
  }

  const listItems = text
    .split(/,|\band\b|\n|;/gi)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/\.$/, ''));

  return Array.from(new Set(listItems));
}

app.post('/api/recognize', async (req, res) => {
  const { imageData } = req.body;
  if (!imageData) {
    return res.status(400).json({ error: 'Missing image data.' });
  }

  if (!GROQ_API_KEY) {
    return res.json({
      ingredients: ['tomatoes', 'cheese', 'spinach'],
      message: 'Demo recognition returned a fallback ingredient set; set GROQ_API_KEY to enable live AI recognition.',
    });
  }

  try {
    const prompt = 'Review the uploaded image and return a comma-separated list of the main ingredients visible. Return ingredient names only.';
    const result = await callGroqAPI(prompt, imageData);
    const text = parseGroqResponse(result);
    const ingredients = normalizeIngredients(text);

    return res.json({
      ingredients: ingredients.length > 0 ? ingredients : ['tomatoes', 'cheese', 'spinach'],
      message: 'Ingredient recognition complete.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ingredients: ['tomatoes', 'cheese', 'spinach'],
      message: 'Ingredient recognition failed. Using fallback demo data.',
    });
  }
});

app.post('/api/generate', async (req, res) => {
  const { ingredients = [], diet = 'balanced', imageData } = req.body;
  const chosenIngredients = Array.isArray(ingredients) && ingredients.length > 0 ? ingredients : [];

  if (!GROQ_API_KEY) {
    return res.json({
      recipe: fallbackRecipe(chosenIngredients, diet),
      ingredients: chosenIngredients,
      message: 'Demo mode active: GROQ API key is not set. Using local recipe fallback.',
    });
  }

  try {
    const prompt = `You are a recipe assistant. Using these ingredients: ${chosenIngredients.join(', ') || 'no ingredients specified'} and a ${diet} diet preference, provide a JSON object with keys title, summary, ingredients, steps, grocery, and calories.`;
    const result = await callGroqAPI(prompt, imageData);
    const text = parseGroqResponse(result);
    const parsed = safeParseJSON(text);

    if (parsed && parsed.title && parsed.steps && parsed.ingredients) {
      return res.json({
        recipe: {
          title: parsed.title,
          summary: parsed.summary || parsed.title,
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map((item) => `• ${item}`).join('\n') : parsed.ingredients || '',
          steps: Array.isArray(parsed.steps) ? parsed.steps : [parsed.steps].filter(Boolean),
          grocery: parsed.grocery || (Array.isArray(parsed.ingredients) ? parsed.ingredients.map((item) => `${item} — 1 portion`).join('\n') : ''),
          calories: parsed.calories || 'Nutrition information not available.',
        },
        ingredients: normalizeIngredients(parsed.ingredients ? parsed.ingredients.join ? parsed.ingredients.join(', ') : parsed.ingredients : chosenIngredients.join(', ')),
        message: 'Recipe generated by GROQ AI.',
      });
    }

    return res.json({
      recipe: fallbackRecipe(chosenIngredients, diet),
      ingredients: chosenIngredients,
      message: 'Groq API response could not be parsed cleanly; returning fallback recipe.',
    });
  } catch (error) {
    console.error(error);
    return res.json({
      recipe: fallbackRecipe(chosenIngredients, diet),
      ingredients: chosenIngredients,
      message: 'Recipe generation failed. Returning a local fallback recipe.',
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`AI Fridge Chef PWA running at http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    const fallbackPort = port + 1;
    console.warn(`Port ${port} is already in use. Trying ${fallbackPort} instead...`);
    app.listen(fallbackPort, () => {
      console.log(`AI Fridge Chef PWA running at http://localhost:${fallbackPort}`);
    });
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});
