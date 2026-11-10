/**
 * IndexedDB Standalone Storage per Lifesum Tracker (Offline First)
 */

const DB_NAME = 'LifesumTrackerDB';
const DB_VERSION = 1;

let dbInstance = null;

export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => reject(`IndexedDB error: ${e.target.error}`);

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Store: profile
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }

      // Store: diets
      if (!db.objectStoreNames.contains('diets')) {
        db.createObjectStore('diets', { keyPath: 'id' });
      }

      // Store: foods
      if (!db.objectStoreNames.contains('foods')) {
        const foodStore = db.createObjectStore('foods', { keyPath: 'id', autoIncrement: true });
        foodStore.createIndex('barcode', 'barcode', { unique: false });
        foodStore.createIndex('title', 'title', { unique: false });
      }

      // Store: diary
      if (!db.objectStoreNames.contains('diary')) {
        const diaryStore = db.createObjectStore('diary', { keyPath: 'id', autoIncrement: true });
        diaryStore.createIndex('date', 'date', { unique: false });
      }

      // Store: water
      if (!db.objectStoreNames.contains('water')) {
        db.createObjectStore('water', { keyPath: 'date' });
      }
    };
  });
}

export async function initStorage() {
  const db = await openDatabase();

  // Check and seed diets
  const dietsCount = await countStore(db, 'diets');
  if (dietsCount === 0) {
    const defaultDiets = [
      { id: 1, name: 'Standard Bilanciata', description: 'Equilibrio mediterraneo classico', carb_pct: 50, protein_pct: 20, fat_pct: 30 },
      { id: 2, name: 'Clean Eating / Fit', description: 'Focus su cibi non processati e proteine moderate', carb_pct: 40, protein_pct: 25, fat_pct: 35 },
      { id: 3, name: 'High Protein (Massa/Definizione)', description: 'Alto apporto proteico per mantenimento muscolare', carb_pct: 35, protein_pct: 40, fat_pct: 25 },
      { id: 4, name: 'Ketogenica Strict / LCHF', description: 'Grassi sani predominanti e bassissimi carboidrati', carb_pct: 5, protein_pct: 20, fat_pct: 75 }
    ];
    for (const d of defaultDiets) {
      await putItem(db, 'diets', d);
    }
  }

  // Check and seed profile
  const profile = await getItem(db, 'profile', 1);
  if (!profile) {
    await putItem(db, 'profile', {
      id: 1,
      name: 'Alex',
      gender: 'male',
      age: 28,
      weight_kg: 75.0,
      height_cm: 178.0,
      activity_level: 1.375,
      goal: 'lose',
      loss_per_week_kg: 0.5,
      diet_id: 1,
      water_goal_ml: 2500
    });
  }

  // Check and seed starter foods
  const foodCount = await countStore(db, 'foods');
  if (foodCount === 0) {
    const starterFoods = [
      { barcode: '8001234567890', title: 'Petto di Pollo ai Ferri', brand: 'Generico', serving_size: '150g', calories_per_100g: 110, carbs_per_100g: 0, protein_per_100g: 23.5, fat_per_100g: 1.2, sugar_per_100g: 0, saturated_fat_per_100g: 0.3, fiber_per_100g: 0, sodium_mg_per_100g: 65, nutriscore: 'A', source: 'local' },
      { barcode: '8009876543210', title: 'Uova Fresche Medie', brand: 'Fattoria', serving_size: '60g (1 uovo)', calories_per_100g: 143, carbs_per_100g: 0.7, protein_per_100g: 12.6, fat_per_100g: 9.5, sugar_per_100g: 0.4, saturated_fat_per_100g: 3.1, fiber_per_100g: 0, sodium_mg_per_100g: 124, nutriscore: 'A', source: 'local' },
      { barcode: '8001111222233', title: 'Riso Basmati Integrale', brand: 'RisoBio', serving_size: '80g', calories_per_100g: 350, carbs_per_100g: 74.0, protein_per_100g: 8.5, fat_per_100g: 2.2, sugar_per_100g: 0.8, saturated_fat_per_100g: 0.5, fiber_per_100g: 3.8, sodium_mg_per_100g: 5, nutriscore: 'A', source: 'local' },
      { barcode: '8003333444455', title: 'Avena in Fiocchi', brand: 'Quaker Style', serving_size: '50g', calories_per_100g: 375, carbs_per_100g: 59.0, protein_per_100g: 13.0, fat_per_100g: 7.0, sugar_per_100g: 1.0, saturated_fat_per_100g: 1.3, fiber_per_100g: 10.0, sodium_mg_per_100g: 6, nutriscore: 'A', source: 'local' },
      { barcode: '8005555666677', title: 'Olio Extra Vergine di Oliva', brand: 'Frantoio', serving_size: '10g (1 cucchiaio)', calories_per_100g: 884, carbs_per_100g: 0, protein_per_100g: 0, fat_per_100g: 100.0, sugar_per_100g: 0, saturated_fat_per_100g: 14.0, fiber_per_100g: 0, sodium_mg_per_100g: 2, nutriscore: 'C', source: 'local' },
      { barcode: '8007777888899', title: 'Yogurt Greco 0% Grassi', brand: 'Fage Total', serving_size: '170g', calories_per_100g: 54, carbs_per_100g: 3.0, protein_per_100g: 10.3, fat_per_100g: 0, sugar_per_100g: 3.0, saturated_fat_per_100g: 0, fiber_per_100g: 0, sodium_mg_per_100g: 45, nutriscore: 'A', source: 'local' },
      { barcode: '8008888999900', title: 'Banana Fresca', brand: 'Ortofrutta', serving_size: '120g (1 banana)', calories_per_100g: 89, carbs_per_100g: 22.8, protein_per_100g: 1.1, fat_per_100g: 0.3, sugar_per_100g: 12.2, saturated_fat_per_100g: 0.1, fiber_per_100g: 2.6, sodium_mg_per_100g: 1, nutriscore: 'A', source: 'local' },
      { barcode: '8009999000011', title: 'Mela Gala', brand: 'Mela Val di Non', serving_size: '150g (1 mela)', calories_per_100g: 52, carbs_per_100g: 13.8, protein_per_100g: 0.3, fat_per_100g: 0.2, sugar_per_100g: 10.4, saturated_fat_per_100g: 0.05, fiber_per_100g: 2.4, sodium_mg_per_100g: 1, nutriscore: 'A', source: 'local' },
      { barcode: '8002222333344', title: 'Filetto di Salmone Fresco', brand: 'Pescheria', serving_size: '150g', calories_per_100g: 208, carbs_per_100g: 0, protein_per_100g: 20.0, fat_per_100g: 13.0, sugar_per_100g: 0, saturated_fat_per_100g: 3.1, fiber_per_100g: 0, sodium_mg_per_100g: 59, nutriscore: 'A', source: 'local' },
      { barcode: '8004444555566', title: 'Noci Secche Sgusciate', brand: 'Life Bio', serving_size: '30g', calories_per_100g: 654, carbs_per_100g: 13.7, protein_per_100g: 15.2, fat_per_100g: 65.2, sugar_per_100g: 2.6, saturated_fat_per_100g: 6.1, fiber_per_100g: 6.7, sodium_mg_per_100g: 2, nutriscore: 'B', source: 'local' }
    ];
    for (const f of starterFoods) {
      await putItem(db, 'foods', f);
    }
  }
}

// --- PROFILE ---
export async function getProfile() {
  const db = await openDatabase();
  const profile = await getItem(db, 'profile', 1);
  const diets = await getAll(db, 'diets');
  const currentDiet = diets.find(d => d.id === profile.diet_id) || diets[0];
  return {
    ...profile,
    diet_name: currentDiet.name,
    carb_pct: currentDiet.carb_pct,
    protein_pct: currentDiet.protein_pct,
    fat_pct: currentDiet.fat_pct
  };
}

export async function updateProfile(updates) {
  const db = await openDatabase();
  const existing = await getItem(db, 'profile', 1);
  const updated = { ...existing, ...updates };
  await putItem(db, 'profile', updated);
  return updated;
}

// --- DIETS ---
export async function getDiets() {
  const db = await openDatabase();
  return getAll(db, 'diets');
}

// --- FOODS ---
export async function searchLocalFoods(query) {
  if (!query) return [];
  const db = await openDatabase();
  const allFoods = await getAll(db, 'foods');
  const q = query.toLowerCase();
  return allFoods.filter(f => 
    (f.title && f.title.toLowerCase().includes(q)) ||
    (f.brand && f.brand.toLowerCase().includes(q))
  ).slice(0, 15);
}

export async function getFoodByBarcode(barcode) {
  if (!barcode) return null;
  const db = await openDatabase();
  const allFoods = await getAll(db, 'foods');
  return allFoods.find(f => f.barcode === barcode) || null;
}

export async function saveFood(food) {
  const db = await openDatabase();
  if (food.barcode) {
    const existing = await getFoodByBarcode(food.barcode);
    if (existing) return existing.id;
  }
  return putItem(db, 'foods', food);
}

// --- DIARY ---
export async function getDiaryItems(date) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('diary', 'readonly');
    const store = tx.objectStore('diary');
    const index = store.index('date');
    const request = index.getAll(IDBKeyRange.only(date));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function addDiaryItem(item) {
  const db = await openDatabase();
  return putItem(db, 'diary', {
    ...item,
    created_at: new Date().toISOString()
  });
}

export async function deleteDiaryItem(id) {
  const db = await openDatabase();
  return deleteItem(db, 'diary', id);
}

// --- WATER ---
export async function getWaterIntake(date) {
  const db = await openDatabase();
  const record = await getItem(db, 'water', date);
  return record ? record.total_ml : 0;
}

export async function addWater(date, amountMl) {
  const db = await openDatabase();
  const current = await getWaterIntake(date);
  const updated = { date, total_ml: current + amountMl };
  await putItem(db, 'water', updated);
  return updated.total_ml;
}

export async function resetWater(date) {
  const db = await openDatabase();
  await putItem(db, 'water', { date, total_ml: 0 });
  return 0;
}

// --- HELPER PROMISES ---
function getItem(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function putItem(db, storeName, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteItem(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).delete(key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

function countStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
