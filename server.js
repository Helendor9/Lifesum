import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, initDatabase } from './db/database.js';
import { calculateTargetCalories, calculateMacroTargets, calculateFoodItemNutrients } from './services/nutritionCalc.js';
import { searchOpenFoodFacts, fetchProductByBarcode } from './services/openFoodFacts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inizializza Database SQLite
initDatabase();

// --- 1. PROFILO & DIETA ---

app.get('/api/profile', (req, res) => {
  try {
    const profile = db.prepare(`
      SELECT p.*, d.name as diet_name, d.carb_pct, d.protein_pct, d.fat_pct
      FROM tbl_profile p
      JOIN tbl_diet d ON p.diet_id = d.id
      LIMIT 1
    `).get();

    const targets = calculateTargetCalories(profile);
    const macroTargets = calculateMacroTargets(targets.targetCalories, {
      carb_pct: profile.carb_pct,
      protein_pct: profile.protein_pct,
      fat_pct: profile.fat_pct
    });

    res.json({
      profile,
      targets: {
        ...targets,
        ...macroTargets
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', (req, res) => {
  try {
    const { name, gender, age, weight_kg, height_cm, activity_level, goal, loss_per_week_kg, diet_id, water_goal_ml } = req.body;
    
    db.prepare(`
      UPDATE tbl_profile
      SET name = COALESCE(?, name),
          gender = COALESCE(?, gender),
          age = COALESCE(?, age),
          weight_kg = COALESCE(?, weight_kg),
          height_cm = COALESCE(?, height_cm),
          activity_level = COALESCE(?, activity_level),
          goal = COALESCE(?, goal),
          loss_per_week_kg = COALESCE(?, loss_per_week_kg),
          diet_id = COALESCE(?, diet_id),
          water_goal_ml = COALESCE(?, water_goal_ml)
      WHERE id = 1
    `).run(name, gender, age, weight_kg, height_cm, activity_level, goal, loss_per_week_kg, diet_id, water_goal_ml);

    res.json({ success: true, message: 'Profilo aggiornato con successo' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/diets', (req, res) => {
  try {
    const diets = db.prepare('SELECT * FROM tbl_diet ORDER BY id').all();
    res.json(diets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. DASHBOARD GIORNALIERA & DIARIO ---

app.get('/api/dashboard', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Recupera profilo e obiettivi
    const profile = db.prepare(`
      SELECT p.*, d.name as diet_name, d.carb_pct, d.protein_pct, d.fat_pct
      FROM tbl_profile p
      JOIN tbl_diet d ON p.diet_id = d.id
      LIMIT 1
    `).get();

    const targets = calculateTargetCalories(profile);
    const macroTargets = calculateMacroTargets(targets.targetCalories, {
      carb_pct: profile.carb_pct,
      protein_pct: profile.protein_pct,
      fat_pct: profile.fat_pct
    });

    // Recupera cibi tracciati per la data indicata
    const foodItems = db.prepare(`
      SELECT i.id, i.date, i.meal_type, i.amount_grams, i.created_at,
             f.id as food_id, f.title, f.brand, f.calories_per_100g,
             f.carbs_per_100g, f.protein_per_100g, f.fat_per_100g,
             f.sugar_per_100g, f.saturated_fat_per_100g, f.fiber_per_100g,
             f.sodium_mg_per_100g, f.nutriscore, f.image_url, f.barcode
      FROM tbl_food_item i
      JOIN tbl_food f ON i.food_id = f.id
      WHERE i.date = ?
      ORDER BY i.id ASC
    `).all(date);

    // Raggruppa per pasti e calcola totali
    const meals = {
      BREAKFAST: { label: 'Colazione', targetCaloriesPct: 25, items: [], calories: 0, carbs: 0, protein: 0, fat: 0 },
      LUNCH: { label: 'Pranzo', targetCaloriesPct: 35, items: [], calories: 0, carbs: 0, protein: 0, fat: 0 },
      DINNER: { label: 'Cena', targetCaloriesPct: 30, items: [], calories: 0, carbs: 0, protein: 0, fat: 0 },
      SNACK: { label: 'Spuntino / Merenda', targetCaloriesPct: 10, items: [], calories: 0, carbs: 0, protein: 0, fat: 0 }
    };

    const totals = {
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      sugar: 0,
      saturatedFat: 0,
      fiber: 0,
      sodiumMg: 0
    };

    for (const item of foodItems) {
      const nutrients = calculateFoodItemNutrients(item, item.amount_grams);
      const enrichedItem = {
        ...item,
        nutrients
      };

      const mealKey = meals[item.meal_type] ? item.meal_type : 'SNACK';
      meals[mealKey].items.push(enrichedItem);
      meals[mealKey].calories = Math.round((meals[mealKey].calories + nutrients.calories) * 10) / 10;
      meals[mealKey].carbs = Math.round((meals[mealKey].carbs + nutrients.carbs) * 10) / 10;
      meals[mealKey].protein = Math.round((meals[mealKey].protein + nutrients.protein) * 10) / 10;
      meals[mealKey].fat = Math.round((meals[mealKey].fat + nutrients.fat) * 10) / 10;

      totals.calories = Math.round((totals.calories + nutrients.calories) * 10) / 10;
      totals.carbs = Math.round((totals.carbs + nutrients.carbs) * 10) / 10;
      totals.protein = Math.round((totals.protein + nutrients.protein) * 10) / 10;
      totals.fat = Math.round((totals.fat + nutrients.fat) * 10) / 10;
      totals.sugar = Math.round((totals.sugar + nutrients.sugar) * 10) / 10;
      totals.saturatedFat = Math.round((totals.saturatedFat + nutrients.saturatedFat) * 10) / 10;
      totals.fiber = Math.round((totals.fiber + nutrients.fiber) * 10) / 10;
      totals.sodiumMg = Math.round(totals.sodiumMg + nutrients.sodiumMg);
    }

    // Calcolo acqua consumata
    const waterRows = db.prepare('SELECT amount_ml FROM tbl_water_intake WHERE date = ?').all(date);
    const waterTotalMl = waterRows.reduce((acc, row) => acc + row.amount_ml, 0);

    const remainingCalories = Math.max(0, macroTargets.targetCalories - Math.round(totals.calories));

    res.json({
      date,
      targets: {
        ...targets,
        ...macroTargets
      },
      consumed: totals,
      remainingCalories,
      progress: {
        caloriesPct: Math.min(100, Math.round((totals.calories / macroTargets.targetCalories) * 100)),
        carbsPct: Math.min(100, Math.round((totals.carbs / macroTargets.carbsGrams) * 100)),
        proteinPct: Math.min(100, Math.round((totals.protein / macroTargets.proteinGrams) * 100)),
        fatPct: Math.min(100, Math.round((totals.fat / macroTargets.fatGrams) * 100)),
        waterPct: Math.min(100, Math.round((waterTotalMl / profile.water_goal_ml) * 100))
      },
      water: {
        totalMl: waterTotalMl,
        goalMl: profile.water_goal_ml
      },
      meals
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aggiungi cibo al diario
app.post('/api/diary/items', async (req, res) => {
  try {
    const { date, meal_type, food_id, amount_grams, open_food_facts_data } = req.body;
    let targetFoodId = food_id;

    // Se l'alimento arriva da Open Food Facts e non ha un ID locale, salvalo nel DB locale
    if (!targetFoodId && open_food_facts_data) {
      const existing = open_food_facts_data.barcode
        ? db.prepare('SELECT id FROM tbl_food WHERE barcode = ?').get(open_food_facts_data.barcode)
        : null;

      if (existing) {
        targetFoodId = existing.id;
      } else {
        const stmt = db.prepare(`
          INSERT INTO tbl_food (barcode, title, brand, serving_size, calories_per_100g, carbs_per_100g, protein_per_100g, fat_per_100g, sugar_per_100g, saturated_fat_per_100g, fiber_per_100g, sodium_mg_per_100g, nutriscore, image_url, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'openfoodfacts')
        `);
        const resInsert = stmt.run(
          open_food_facts_data.barcode || null,
          open_food_facts_data.title,
          open_food_facts_data.brand || 'Generico',
          open_food_facts_data.serving_size || '100g',
          open_food_facts_data.calories_per_100g,
          open_food_facts_data.carbs_per_100g || 0,
          open_food_facts_data.protein_per_100g || 0,
          open_food_facts_data.fat_per_100g || 0,
          open_food_facts_data.sugar_per_100g || 0,
          open_food_facts_data.saturated_fat_per_100g || 0,
          open_food_facts_data.fiber_per_100g || 0,
          open_food_facts_data.sodium_mg_per_100g || 0,
          open_food_facts_data.nutriscore || null,
          open_food_facts_data.image_url || null
        );
        targetFoodId = Number(resInsert.lastInsertRowid);
      }
    }

    if (!targetFoodId) {
      return res.status(400).json({ error: 'food_id mancante o dati Open Food Facts non validi' });
    }

    const insertItem = db.prepare(`
      INSERT INTO tbl_food_item (date, meal_type, food_id, amount_grams)
      VALUES (?, ?, ?, ?)
    `);
    const result = insertItem.run(date, meal_type, targetFoodId, parseFloat(amount_grams) || 100);

    res.json({
      success: true,
      insertedId: Number(result.lastInsertRowid),
      message: 'Alimento aggiunto al diario'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Elimina alimento dal diario
app.delete('/api/diary/items/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM tbl_food_item WHERE id = ?').run(id);
    res.json({ success: true, message: 'Alimento rimosso dal diario' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 3. RICERCA ALIMENTI & OPEN FOOD FACTS ---

app.get('/api/food/search', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) return res.json({ local: [], external: [] });

    // 1. Ricerca locale in tbl_food
    const localFoods = db.prepare(`
      SELECT * FROM tbl_food
      WHERE title LIKE ? OR brand LIKE ?
      LIMIT 10
    `).all(`%${query}%`, `%${query}%`);

    // 2. Ricerca su Open Food Facts
    let externalFoods = [];
    if (req.query.include_external !== 'false') {
      externalFoods = await searchOpenFoodFacts(query, 10);
    }

    res.json({
      local: localFoods,
      external: externalFoods
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ricerca per Codice a Barre (Barcode / EAN-13)
app.get('/api/food/barcode/:code', async (req, res) => {
  try {
    const code = req.params.code;
    
    // Controlla prima nel DB locale
    const local = db.prepare('SELECT * FROM tbl_food WHERE barcode = ?').get(code);
    if (local) {
      return res.json({ found: true, source: 'local', product: local });
    }

    // Se non presente, interroga Open Food Facts
    const product = await fetchProductByBarcode(code);
    if (product) {
      return res.json({ found: true, source: 'openfoodfacts', product });
    }

    res.status(404).json({ found: false, message: 'Nessun prodotto trovato per questo codice a barre' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. TRACKING ACQUA ---

app.post('/api/water', (req, res) => {
  try {
    const { date, amount_ml } = req.body;
    db.prepare('INSERT INTO tbl_water_intake (date, amount_ml) VALUES (?, ?)').run(date, amount_ml || 250);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/water', (req, res) => {
  try {
    const date = req.query.date;
    db.prepare('DELETE FROM tbl_water_intake WHERE date = ?').run(date);
    res.json({ success: true, message: 'Contatore acqua azzerato' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Lifesum Tracker Server avviato su http://localhost:${PORT} e su rete locale http://192.168.1.225:${PORT}`);
});
