/**
 * Lifesum Clone - 100% Standalone Offline Mobile Application Logic
 */

import {
  initStorage,
  getProfile,
  updateProfile,
  getDiets,
  searchLocalFoods,
  getFoodByBarcode,
  saveFood,
  getDiaryItems,
  addDiaryItem,
  deleteDiaryItem,
  getWaterIntake,
  addWater,
  resetWater
} from './js/indexedDb.js';

import {
  calculateTargetCalories,
  calculateMacroTargets,
  calculateFoodItemNutrients
} from './js/nutritionCalc.js';

import {
  searchOpenFoodFacts,
  fetchProductByBarcode
} from './js/openFoodFacts.js';

let currentDate = new Date().toISOString().split('T')[0];
let activeMealType = 'BREAKFAST';
let selectedFood = null;
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initStorage();
    initDateControls();
    initModals();
    initWaterControls();
    initMicrosToggle();
    initSearchAndBarcode();
    initProfileForm();

    await loadDiets();
    await loadProfile();
    await loadDashboard(currentDate);
  } catch (err) {
    console.error('Inizializzazione fallita:', err);
  }
});

// --- DATE CONTROLS ---

function initDateControls() {
  const display = document.getElementById('current-date-display');
  const picker = document.getElementById('date-picker-hidden');
  const prevBtn = document.getElementById('prev-date-btn');
  const nextBtn = document.getElementById('next-date-btn');

  updateDateDisplay();

  prevBtn.addEventListener('click', () => shiftDate(-1));
  nextBtn.addEventListener('click', () => shiftDate(1));

  display.addEventListener('click', () => {
    picker.value = currentDate;
    picker.showPicker ? picker.showPicker() : picker.click();
  });

  picker.addEventListener('change', (e) => {
    if (e.target.value) {
      currentDate = e.target.value;
      updateDateDisplay();
      loadDashboard(currentDate);
    }
  });
}

function shiftDate(deltaDays) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + deltaDays);
  currentDate = d.toISOString().split('T')[0];
  updateDateDisplay();
  loadDashboard(currentDate);
}

function updateDateDisplay() {
  const display = document.getElementById('current-date-display');
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  if (currentDate === today) {
    display.textContent = 'Oggi';
  } else if (currentDate === yesterday) {
    display.textContent = 'Ieri';
  } else if (currentDate === tomorrow) {
    display.textContent = 'Domani';
  } else {
    const d = new Date(currentDate);
    display.textContent = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}

// --- DASHBOARD RENDERING (COMPUTATO IN LOCALE SU INDEXEDDB) ---

async function loadDashboard(date) {
  try {
    const profile = await getProfile();
    const targets = calculateTargetCalories(profile);
    const macroTargets = calculateMacroTargets(targets.targetCalories, {
      carb_pct: profile.carb_pct,
      protein_pct: profile.protein_pct,
      fat_pct: profile.fat_pct
    });

    const foodItems = await getDiaryItems(date);

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
      const food = item.food_snapshot || {};
      const nutrients = calculateFoodItemNutrients(food, item.amount_grams);
      const enrichedItem = {
        ...item,
        title: food.title,
        brand: food.brand,
        image_url: food.image_url,
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

    const waterTotalMl = await getWaterIntake(date);
    const remainingCalories = Math.max(0, macroTargets.targetCalories - Math.round(totals.calories));

    const dashboardData = {
      date,
      targets: { ...targets, ...macroTargets },
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
    };

    renderDashboard(dashboardData);
  } catch (err) {
    console.error('Errore render dashboard locale:', err);
  }
}

function renderDashboard(data) {
  const targets = data.targets;
  const consumed = data.consumed;
  const remaining = data.remainingCalories;

  document.getElementById('ring-remaining-calories').textContent = remaining;
  document.getElementById('target-calories-val').textContent = targets.targetCalories;
  document.getElementById('consumed-calories-val').textContent = Math.round(consumed.calories);

  const circumference = 314.16;
  const ratio = Math.min(1, consumed.calories / targets.targetCalories);
  const offset = circumference * (1 - ratio);
  const ring = document.getElementById('calorie-ring');
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = consumed.calories > targets.targetCalories ? '#ef4444' : '#22c55e';

  document.getElementById('carbs-consumed').textContent = Math.round(consumed.carbs);
  document.getElementById('carbs-target').textContent = targets.carbsGrams;
  document.getElementById('carbs-bar').style.width = `${data.progress.carbsPct}%`;

  document.getElementById('protein-consumed').textContent = Math.round(consumed.protein);
  document.getElementById('protein-target').textContent = targets.proteinGrams;
  document.getElementById('protein-bar').style.width = `${data.progress.proteinPct}%`;

  document.getElementById('fat-consumed').textContent = Math.round(consumed.fat);
  document.getElementById('fat-target').textContent = targets.fatGrams;
  document.getElementById('fat-bar').style.width = `${data.progress.fatPct}%`;

  document.getElementById('micro-fiber').textContent = consumed.fiber;
  document.getElementById('micro-sugar').textContent = consumed.sugar;
  document.getElementById('micro-sat-fat').textContent = consumed.saturatedFat;
  document.getElementById('micro-sodium').textContent = consumed.sodiumMg;

  document.getElementById('water-current-ml').textContent = data.water.totalMl;
  document.getElementById('water-goal-ml').textContent = data.water.goalMl;
  document.getElementById('water-progress-bar').style.width = `${data.progress.waterPct}%`;

  renderMeals(data.meals);
}

function renderMeals(meals) {
  const container = document.getElementById('meals-list-container');
  container.innerHTML = '';

  const mealIcons = {
    BREAKFAST: '☕',
    LUNCH: '🥗',
    DINNER: '🍲',
    SNACK: '🍎'
  };

  Object.entries(meals).forEach(([type, meal]) => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-4 shadow-sm border border-slate-100 meal-card';

    let itemsHtml = '';
    if (meal.items.length === 0) {
      itemsHtml = `<p class="text-xs text-slate-400 italic py-1">Nessun alimento registrato</p>`;
    } else {
      itemsHtml = meal.items.map(item => `
        <div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-none text-xs">
          <div class="flex items-center space-x-2.5">
            ${item.image_url ? `<img src="${item.image_url}" class="w-8 h-8 rounded-lg object-cover border border-slate-100">` : ''}
            <div>
              <p class="font-bold text-slate-800">${escapeHtml(item.title)}</p>
              <p class="text-[11px] text-slate-400">
                ${item.amount_grams}g · ${item.nutrients.calories} kcal 
                (C: ${item.nutrients.carbs}g · P: ${item.nutrients.protein}g · G: ${item.nutrients.fat}g)
              </p>
            </div>
          </div>
          <button onclick="window.removeDiaryItem(${item.id})" class="text-slate-300 hover:text-red-500 p-1 transition" title="Rimuovi">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      `).join('');
    }

    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <span class="text-lg">${mealIcons[type] || '🍽️'}</span>
          <span class="font-bold text-sm text-slate-800">${meal.label}</span>
        </div>
        <div class="flex items-center space-x-3">
          <span class="text-xs font-bold text-slate-600">${meal.calories} <span class="font-normal text-slate-400">kcal</span></span>
          <button onclick="window.openAddFoodModal('${type}', '${meal.label}')" class="w-7 h-7 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm transition">
            +
          </button>
        </div>
      </div>
      <div class="space-y-1">
        ${itemsHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

// --- WATER CONTROLS ---

function initWaterControls() {
  document.getElementById('add-water-250-btn').addEventListener('click', async () => {
    await addWater(currentDate, 250);
    loadDashboard(currentDate);
  });

  document.getElementById('reset-water-btn').addEventListener('click', async () => {
    if (confirm('Vuoi azzerare il contatore dell\'acqua di oggi?')) {
      await resetWater(currentDate);
      loadDashboard(currentDate);
    }
  });
}

function initMicrosToggle() {
  const btn = document.getElementById('toggle-micros-btn');
  const container = document.getElementById('micros-container');
  const chevron = document.getElementById('micros-chevron');

  btn.addEventListener('click', () => {
    container.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
  });
}

// --- MODALS ---

function initModals() {
  const modal = document.getElementById('add-food-modal');
  const closeBtn = document.getElementById('close-food-modal-btn');
  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    resetFoodSelection();
  });

  const searchTabBtn = document.getElementById('tab-search-btn');
  const barcodeTabBtn = document.getElementById('tab-barcode-btn');
  const searchContent = document.getElementById('tab-content-search');
  const barcodeContent = document.getElementById('tab-content-barcode');

  searchTabBtn.addEventListener('click', () => {
    searchTabBtn.classList.add('bg-white', 'shadow-sm', 'text-slate-900');
    searchTabBtn.classList.remove('text-slate-500');
    barcodeTabBtn.classList.remove('bg-white', 'shadow-sm', 'text-slate-900');
    barcodeTabBtn.classList.add('text-slate-500');
    searchContent.classList.remove('hidden');
    barcodeContent.classList.add('hidden');
  });

  barcodeTabBtn.addEventListener('click', () => {
    barcodeTabBtn.classList.add('bg-white', 'shadow-sm', 'text-slate-900');
    barcodeTabBtn.classList.remove('text-slate-500');
    searchTabBtn.classList.remove('bg-white', 'shadow-sm', 'text-slate-900');
    searchTabBtn.classList.add('text-slate-500');
    barcodeContent.classList.remove('hidden');
    searchContent.classList.add('hidden');
  });

  document.getElementById('portion-amount-input').addEventListener('input', updatePortionCalculation);
  document.getElementById('confirm-add-food-btn').addEventListener('click', confirmAddFoodToDiary);
}

window.openAddFoodModal = function(mealType, mealLabel) {
  activeMealType = mealType;
  document.getElementById('modal-meal-title').textContent = `Aggiungi a ${mealLabel}`;
  document.getElementById('add-food-modal').classList.remove('hidden');
  resetFoodSelection();
  document.getElementById('food-search-input').focus();
  triggerSearch('pollo');
};

function resetFoodSelection() {
  selectedFood = null;
  document.getElementById('portion-selector-panel').classList.add('hidden');
}

// --- SEARCH & BARCODE ---

function initSearchAndBarcode() {
  const searchInput = document.getElementById('food-search-input');
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const q = e.target.value.trim();
    if (q.length < 2) return;
    searchDebounceTimer = setTimeout(() => {
      triggerSearch(q);
    }, 300);
  });

  const barcodeInput = document.getElementById('barcode-input');
  const barcodeBtn = document.getElementById('barcode-search-btn');

  barcodeBtn.addEventListener('click', () => {
    const code = barcodeInput.value.trim();
    if (code) lookupBarcode(code);
  });

  document.querySelectorAll('.barcode-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const code = pill.dataset.code;
      barcodeInput.value = code;
      lookupBarcode(code);
    });
  });
}

async function triggerSearch(query) {
  const loading = document.getElementById('search-loading');
  const resultsContainer = document.getElementById('search-results-list');
  loading.classList.remove('hidden');
  resultsContainer.innerHTML = '';

  try {
    // 1. Cerca in locale su IndexedDB (funziona anche offline!)
    const localFoods = await searchLocalFoods(query);

    // 2. Cerca su Open Food Facts API (se connesso a internet)
    let externalFoods = [];
    if (navigator.onLine) {
      externalFoods = await searchOpenFoodFacts(query, 10);
    }

    loading.classList.add('hidden');
    renderSearchResults({ local: localFoods, external: externalFoods });
  } catch (err) {
    loading.classList.add('hidden');
    console.error(err);
  }
}

function renderSearchResults(data) {
  const container = document.getElementById('search-results-list');
  container.innerHTML = '';

  const allItems = [
    ...(data.local || []).map(f => ({ ...f, isLocal: true })),
    ...(data.external || []).map(f => ({ ...f, isLocal: false }))
  ];

  if (allItems.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Nessun alimento trovato per questa ricerca.</p>`;
    return;
  }

  allItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'p-3 rounded-2xl border border-slate-100 hover:border-brand-500 hover:bg-brand-50/30 cursor-pointer transition flex items-center justify-between text-xs';
    
    el.innerHTML = `
      <div class="flex items-center space-x-3">
        ${item.image_url ? `<img src="${item.image_url}" class="w-10 h-10 rounded-xl object-cover border border-slate-100">` : `
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400">🍽️</div>
        `}
        <div>
          <div class="flex items-center space-x-1.5">
            <span class="font-bold text-slate-800">${escapeHtml(item.title)}</span>
            ${item.nutriscore ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-black badge-nutriscore-${item.nutriscore}">${item.nutriscore}</span>` : ''}
            <span class="text-[10px] px-1.5 py-0.5 rounded ${item.isLocal ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700 font-bold'}">
              ${item.isLocal ? 'Locale' : 'Open Food Facts'}
            </span>
          </div>
          <p class="text-slate-400 text-[11px] mt-0.5">${escapeHtml(item.brand || 'Generico')} · ${item.calories_per_100g} kcal / 100g</p>
          <p class="text-slate-500 text-[10px] mt-0.5">C: ${item.carbs_per_100g}g · P: ${item.protein_per_100g}g · G: ${item.fat_per_100g}g</p>
        </div>
      </div>
      <span class="text-brand-600 font-bold text-lg">+</span>
    `;

    el.addEventListener('click', () => selectFoodForPortion(item));
    container.appendChild(el);
  });
}

async function lookupBarcode(code) {
  const card = document.getElementById('barcode-result-card');
  card.innerHTML = `<div class="text-center py-4 text-xs text-slate-400">Ricerca codice a barre...</div>`;
  card.classList.remove('hidden');

  try {
    // 1. Controlla prima in IndexedDB locale
    let product = await getFoodByBarcode(code);

    // 2. Se non presente e online, interroga Open Food Facts
    if (!product && navigator.onLine) {
      product = await fetchProductByBarcode(code);
    }

    if (!product) {
      card.innerHTML = `<div class="p-3 bg-red-50 text-red-600 rounded-xl text-xs">Codice a barre non trovato. Prova con la ricerca testuale.</div>`;
      return;
    }

    card.innerHTML = `
      <div class="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            ${product.image_url ? `<img src="${product.image_url}" class="w-12 h-12 rounded-xl object-cover border border-emerald-200">` : ''}
            <div>
              <span class="font-bold text-sm text-slate-900 block">${escapeHtml(product.title)}</span>
              <span class="text-slate-500">${escapeHtml(product.brand)} · ${product.calories_per_100g} kcal / 100g</span>
            </div>
          </div>
          ${product.nutriscore ? `<span class="px-2 py-1 rounded text-xs font-black badge-nutriscore-${product.nutriscore}">Nutri-Score ${product.nutriscore}</span>` : ''}
        </div>
        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100 text-center text-[11px] font-semibold text-slate-600">
          <div>Carboidrati: <span class="font-bold text-macro-carbs">${product.carbs_per_100g}g</span></div>
          <div>Proteine: <span class="font-bold text-macro-protein">${product.protein_per_100g}g</span></div>
          <div>Grassi: <span class="font-bold text-macro-fat">${product.fat_per_100g}g</span></div>
        </div>
        <button id="select-barcode-food-btn" class="w-full mt-2 py-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition">
          Seleziona questo Alimento
        </button>
      </div>
    `;

    document.getElementById('select-barcode-food-btn').addEventListener('click', () => {
      selectFoodForPortion(product);
    });

  } catch (err) {
    card.innerHTML = `<div class="p-3 bg-red-50 text-red-600 rounded-xl text-xs">Errore di connessione.</div>`;
  }
}

function selectFoodForPortion(food) {
  selectedFood = food;
  const panel = document.getElementById('portion-selector-panel');
  panel.classList.remove('hidden');

  document.getElementById('selected-food-name').textContent = food.title;
  document.getElementById('selected-food-per100').textContent = `${food.calories_per_100g} kcal per 100g (${food.brand || 'Generico'})`;

  document.getElementById('portion-amount-input').value = 100;
  updatePortionCalculation();
  panel.scrollIntoView({ behavior: 'smooth' });
}

function updatePortionCalculation() {
  if (!selectedFood) return;
  const grams = parseFloat(document.getElementById('portion-amount-input').value) || 0;
  const cals = Math.round((selectedFood.calories_per_100g * grams) / 100);
  document.getElementById('calculated-food-calories').textContent = cals;
}

async function confirmAddFoodToDiary() {
  if (!selectedFood) return;
  const grams = parseFloat(document.getElementById('portion-amount-input').value) || 100;

  // Assicurati che l'alimento sia salvato in IndexedDB per essere sempre disponibile offline
  await saveFood(selectedFood);

  await addDiaryItem({
    date: currentDate,
    meal_type: activeMealType,
    amount_grams: grams,
    food_snapshot: selectedFood
  });

  document.getElementById('add-food-modal').classList.add('hidden');
  resetFoodSelection();
  loadDashboard(currentDate);
}

window.removeDiaryItem = async function(id) {
  if (confirm('Vuoi rimuovere questo alimento dal diario?')) {
    await deleteDiaryItem(id);
    loadDashboard(currentDate);
  }
};

// --- PROFILE & DIETS MODAL ---

function initProfileForm() {
  const modal = document.getElementById('profile-modal');
  document.getElementById('open-profile-btn').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('close-profile-modal-btn').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('prof-name').value,
      gender: document.getElementById('prof-gender').value,
      age: parseInt(document.getElementById('prof-age').value, 10),
      weight_kg: parseFloat(document.getElementById('prof-weight').value),
      height_cm: parseFloat(document.getElementById('prof-height').value),
      activity_level: parseFloat(document.getElementById('prof-activity').value),
      goal: document.getElementById('prof-goal').value,
      diet_id: parseInt(document.getElementById('prof-diet').value, 10)
    };

    await updateProfile(payload);
    modal.classList.add('hidden');
    await loadProfile();
    await loadDashboard(currentDate);
  });
}

async function loadDiets() {
  const diets = await getDiets();
  const select = document.getElementById('prof-diet');
  select.innerHTML = diets.map(d => `
    <option value="${d.id}">${d.name} (C: ${d.carb_pct}% · P: ${d.protein_pct}% · G: ${d.fat_pct}%)</option>
  `).join('');
}

async function loadProfile() {
  const p = await getProfile();
  document.getElementById('header-user-name').textContent = p.name;
  document.getElementById('prof-name').value = p.name;
  document.getElementById('prof-gender').value = p.gender;
  document.getElementById('prof-age').value = p.age;
  document.getElementById('prof-weight').value = p.weight_kg;
  document.getElementById('prof-height').value = p.height_cm;
  document.getElementById('prof-activity').value = p.activity_level;
  document.getElementById('prof-goal').value = p.goal;
  document.getElementById('prof-diet').value = p.diet_id;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Register Service Worker per offline caching PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('✅ ServiceWorker Offline registrato:', reg.scope))
      .catch((err) => console.warn('ServiceWorker fallback:', err));
  });
}
