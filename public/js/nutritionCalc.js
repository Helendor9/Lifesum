/**
 * Servizio per i calcoli nutrizionali basati sul reverse engineering di Lifesum
 */

export function calculateBMR(gender, weightKg, heightCm, age) {
  if (gender === 'female') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
}

export function calculateTDEE(bmr, activityLevel) {
  return Math.round(bmr * activityLevel);
}

export function calculateTargetCalories(profile) {
  const bmr = calculateBMR(profile.gender, profile.weight_kg, profile.height_cm, profile.age);
  const tdee = calculateTDEE(bmr, profile.activity_level);

  let target = tdee;
  if (profile.goal === 'lose') {
    const dailyDeficit = Math.round((profile.loss_per_week_kg * 7700) / 7);
    target = tdee - dailyDeficit;
    
    // Safety check Lifesum: non scendere sotto il BMR di base o soglia minima
    const minCalories = profile.gender === 'female' ? 1200 : 1500;
    if (target < minCalories) target = minCalories;
  } else if (profile.goal === 'gain') {
    target = tdee + 350;
  }

  return {
    bmr,
    tdee,
    targetCalories: target
  };
}

export function calculateMacroTargets(targetCalories, diet) {
  const carbCalories = targetCalories * (diet.carb_pct / 100);
  const proteinCalories = targetCalories * (diet.protein_pct / 100);
  const fatCalories = targetCalories * (diet.fat_pct / 100);

  return {
    targetCalories,
    carbsGrams: Math.round(carbCalories / 4),
    proteinGrams: Math.round(proteinCalories / 4),
    fatGrams: Math.round(fatCalories / 9),
    carbPct: diet.carb_pct,
    proteinPct: diet.protein_pct,
    fatPct: diet.fat_pct
  };
}

export function calculateFoodItemNutrients(food, amountGrams) {
  const factor = amountGrams / 100;
  return {
    calories: Math.round((food.calories_per_100g || 0) * factor * 10) / 10,
    carbs: Math.round((food.carbs_per_100g || 0) * factor * 10) / 10,
    protein: Math.round((food.protein_per_100g || 0) * factor * 10) / 10,
    fat: Math.round((food.fat_per_100g || 0) * factor * 10) / 10,
    sugar: Math.round((food.sugar_per_100g || 0) * factor * 10) / 10,
    saturatedFat: Math.round((food.saturated_fat_per_100g || 0) * factor * 10) / 10,
    fiber: Math.round((food.fiber_per_100g || 0) * factor * 10) / 10,
    sodiumMg: Math.round((food.sodium_mg_per_100g || 0) * factor * 10) / 10
  };
}
