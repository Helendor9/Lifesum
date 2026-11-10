import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'tracker.db');

export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tbl_diet (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      carb_pct REAL NOT NULL,
      protein_pct REAL NOT NULL,
      fat_pct REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tbl_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT 'Utente',
      gender TEXT DEFAULT 'male',
      age INTEGER DEFAULT 28,
      weight_kg REAL DEFAULT 75.0,
      height_cm REAL DEFAULT 178.0,
      activity_level REAL DEFAULT 1.375,
      goal TEXT DEFAULT 'lose',
      loss_per_week_kg REAL DEFAULT 0.5,
      diet_id INTEGER DEFAULT 1,
      water_goal_ml INTEGER DEFAULT 2500,
      FOREIGN KEY (diet_id) REFERENCES tbl_diet(id)
    );

    CREATE TABLE IF NOT EXISTS tbl_food (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      title TEXT NOT NULL,
      brand TEXT,
      serving_size TEXT DEFAULT '100g',
      calories_per_100g REAL NOT NULL,
      carbs_per_100g REAL DEFAULT 0,
      protein_per_100g REAL DEFAULT 0,
      fat_per_100g REAL DEFAULT 0,
      sugar_per_100g REAL DEFAULT 0,
      saturated_fat_per_100g REAL DEFAULT 0,
      fiber_per_100g REAL DEFAULT 0,
      sodium_mg_per_100g REAL DEFAULT 0,
      nutriscore TEXT,
      image_url TEXT,
      source TEXT DEFAULT 'local'
    );

    CREATE TABLE IF NOT EXISTS tbl_food_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      food_id INTEGER NOT NULL,
      amount_grams REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (food_id) REFERENCES tbl_food(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tbl_water_intake (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount_ml INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Diets
  const dietCount = db.prepare('SELECT COUNT(*) as count FROM tbl_diet').get().count;
  if (dietCount === 0) {
    const insertDiet = db.prepare(`
      INSERT INTO tbl_diet (id, name, description, carb_pct, protein_pct, fat_pct)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertDiet.run(1, 'Standard Bilanciata', 'Equilibrio mediterraneo classico', 50, 20, 30);
    insertDiet.run(2, 'Clean Eating / Fit', 'Focus su cibi non processati e proteine moderate', 40, 25, 35);
    insertDiet.run(3, 'High Protein (Massa/Definizione)', 'Alto apporto proteico per mantenimento muscolare', 35, 40, 25);
    insertDiet.run(4, 'Ketogenica Strict / LCHF', 'Grassi sani predominanti e bassissimi carboidrati', 5, 20, 75);
  }

  // Seed Profile if none
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM tbl_profile').get().count;
  if (profileCount === 0) {
    db.prepare(`
      INSERT INTO tbl_profile (name, gender, age, weight_kg, height_cm, activity_level, goal, loss_per_week_kg, diet_id, water_goal_ml)
      VALUES ('Alex', 'male', 28, 75.0, 178.0, 1.375, 'lose', 0.5, 1, 2500)
    `).run();
  }

  // Seed Initial Foods if table empty
  const foodCount = db.prepare('SELECT COUNT(*) as count FROM tbl_food').get().count;
  if (foodCount === 0) {
    const insertFood = db.prepare(`
      INSERT INTO tbl_food (barcode, title, brand, serving_size, calories_per_100g, carbs_per_100g, protein_per_100g, fat_per_100g, sugar_per_100g, saturated_fat_per_100g, fiber_per_100g, sodium_mg_per_100g, nutriscore, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertFood.run('8001234567890', 'Petto di Pollo ai Ferri', 'Generico', '150g', 110, 0, 23.5, 1.2, 0, 0.3, 0, 65, 'A', 'local');
    insertFood.run('8009876543210', 'Uova Fresche Medie', 'Fattoria', '60g (1 uovo)', 143, 0.7, 12.6, 9.5, 0.4, 3.1, 0, 124, 'A', 'local');
    insertFood.run('8001111222233', 'Riso Basmati Integrale', 'RisoBio', '80g', 350, 74.0, 8.5, 2.2, 0.8, 0.5, 3.8, 5, 'A', 'local');
    insertFood.run('8003333444455', 'Avena in Fiocchi', 'Quaker Style', '50g', 375, 59.0, 13.0, 7.0, 1.0, 1.3, 10.0, 6, 'A', 'local');
    insertFood.run('8005555666677', 'Olio Extra Vergine di Oliva', 'Frantoio', '10g (1 cucchiaio)', 884, 0, 0, 100.0, 0, 14.0, 0, 2, 'C', 'local');
    insertFood.run('8007777888899', 'Yogurt Greco 0% Grassi', 'Fage Total', '170g', 54, 3.0, 10.3, 0, 3.0, 0, 0, 45, 'A', 'local');
    insertFood.run('8008888999900', 'Banana Fresca', 'Ortofrutta', '120g (1 banana)', 89, 22.8, 1.1, 0.3, 12.2, 0.1, 2.6, 1, 'A', 'local');
    insertFood.run('8009999000011', 'Mela Gala', 'Mela Val di Non', '150g (1 mela)', 52, 13.8, 0.3, 0.2, 10.4, 0.05, 2.4, 1, 'A', 'local');
    insertFood.run('8002222333344', 'Filetto di Salmone Fresco', 'Pescheria', '150g', 208, 0, 20.0, 13.0, 0, 3.1, 0, 59, 'A', 'local');
    insertFood.run('8004444555566', 'Noci Secche Sgusciate', 'Life Bio', '30g', 654, 13.7, 15.2, 65.2, 2.6, 6.1, 6.7, 2, 'B', 'local');
    insertFood.run('8006666777788', 'Parmigiano Reggiano 24 Mesi', 'DOP', '25g', 402, 0, 32.4, 29.7, 0, 19.6, 0, 650, 'D', 'local');
  }

  console.log('✅ SQLite Database inizializzato con successo con tabelle e seed di Lifesum!');
}
