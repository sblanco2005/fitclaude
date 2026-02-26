/**
 * Utilities for the personal food database — parsing food names and quantities
 * from raw input strings like "130g chicken breast" or "2 protein shakes".
 */

const UNITS_MAP: Record<string, string> = {
  g: 'g', oz: 'oz', ml: 'ml', lb: 'lb', lbs: 'lb',
  cup: 'cup', cups: 'cup', tbsp: 'tbsp', tsp: 'tsp',
  scoop: 'scoop', scoops: 'scoop',
  piece: 'unit', pieces: 'unit',
  slice: 'unit', slices: 'unit',
  can: 'unit', cans: 'unit',
  bottle: 'unit', bottles: 'unit',
  container: 'unit', serving: 'unit', servings: 'unit',
};

export function extractFoodInfo(rawInput: string): {
  name: string;
  amount: number;
  unit: string;
} {
  const raw = rawInput.trim();

  // Pattern: "130g chicken breast" or "2 scoops protein powder" or "1 protein shake"
  const match = raw.match(
    /^(\d+\.?\d*)\s*(g|oz|ml|cups?|tbsp|tsp|scoops?|pieces?|slices?|cans?|bottles?|containers?|servings?|lbs?)?\s*(?:of\s+)?(.+)$/i
  );

  if (match) {
    const amount = parseFloat(match[1]);
    const rawUnit = match[2]?.toLowerCase();
    const unit = rawUnit ? (UNITS_MAP[rawUnit] || 'unit') : 'unit';
    return { name: match[3].toLowerCase().trim(), amount, unit };
  }

  // No quantity prefix — treat as 1 unit
  return { name: raw.toLowerCase().trim(), amount: 1, unit: 'unit' };
}
