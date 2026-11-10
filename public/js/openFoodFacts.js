/**
 * Client per Open Food Facts API (Chiamate dirette da Web / Mobile)
 */

export async function searchOpenFoodFacts(query, pageSize = 12) {
  if (!query || query.trim().length < 2) return [];

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageSize}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return [];

    const data = await response.json();
    const products = data.products || [];

    return products
      .filter(p => p.product_name && p.nutriments)
      .map(p => normalizeOpenFoodFactsProduct(p));
  } catch (err) {
    console.warn('Open Food Facts search non disponibile (offline o errore rete):', err.message);
    return [];
  }
}

export async function fetchProductByBarcode(barcode) {
  if (!barcode) return null;
  const cleanBarcode = barcode.trim().replace(/\s+/g, '');
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      return null;
    }

    return normalizeOpenFoodFactsProduct(data.product);
  } catch (err) {
    console.warn('Open Food Facts barcode lookup offline o non disponibile:', err.message);
    return null;
  }
}

function normalizeOpenFoodFactsProduct(product) {
  const n = product.nutriments || {};

  let calories = parseFloat(n['energy-kcal_100g'] ?? n['energy-kcal_value'] ?? n['energy-kcal'] ?? 0);
  if (!calories && n['energy_100g']) {
    calories = Math.round(parseFloat(n['energy_100g']) / 4.184);
  }

  const carbs = parseFloat(n['carbohydrates_100g'] ?? n['carbohydrates'] ?? 0);
  const protein = parseFloat(n['proteins_100g'] ?? n['proteins'] ?? 0);
  const fat = parseFloat(n['fat_100g'] ?? n['fat'] ?? 0);
  const sugar = parseFloat(n['sugars_100g'] ?? n['sugars'] ?? 0);
  const saturatedFat = parseFloat(n['saturated-fat_100g'] ?? n['saturated-fat'] ?? 0);
  const fiber = parseFloat(n['fiber_100g'] ?? n['fiber'] ?? 0);

  let sodiumMg = 0;
  if (n['sodium_100g'] !== undefined) {
    sodiumMg = Math.round(parseFloat(n['sodium_100g']) * 1000);
  } else if (n['salt_100g'] !== undefined) {
    sodiumMg = Math.round((parseFloat(n['salt_100g']) / 2.5) * 1000);
  }

  const nutriscore = product.nutrition_grades_tags?.[0]?.toUpperCase() || product.nutriscore_grade?.toUpperCase() || null;

  return {
    barcode: product.code || null,
    title: product.product_name_it || product.product_name || 'Alimento senza nome',
    brand: product.brands || 'Generico',
    serving_size: product.serving_size || '100g',
    calories_per_100g: Math.round(calories * 10) / 10,
    carbs_per_100g: Math.round(carbs * 10) / 10,
    protein_per_100g: Math.round(protein * 10) / 10,
    fat_per_100g: Math.round(fat * 10) / 10,
    sugar_per_100g: Math.round(sugar * 10) / 10,
    saturated_fat_per_100g: Math.round(saturatedFat * 10) / 10,
    fiber_per_100g: Math.round(fiber * 10) / 10,
    sodium_mg_per_100g: sodiumMg,
    nutriscore: nutriscore,
    image_url: product.image_front_small_url || product.image_url || null,
    source: 'openfoodfacts'
  };
}
