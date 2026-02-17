/**
 * Faction translation utilities
 * Provides consistent faction name translation across all pages.
 * Handles both English IDs (rationalism) and legacy Korean names (합리주의).
 */

// Map legacy Korean faction names to their English IDs
const KOREAN_TO_ID: Record<string, string> = {
  '합리주의': 'rationalism',
  '경험주의': 'empiricism',
  '실용주의': 'pragmatism',
  '이상주의': 'idealism',
};

// Emoji map for factions
export const FACTION_EMOJI: Record<string, string> = {
  rationalism: '🧠',
  empiricism: '🔬',
  pragmatism: '⚙️',
  idealism: '✨',
  // Fallback for legacy Korean names
  '합리주의': '🧠',
  '경험주의': '🔬',
  '실용주의': '⚙️',
  '이상주의': '✨',
};

/**
 * Normalizes a faction identifier to its English key.
 * Handles both English IDs and legacy Korean names from the database.
 */
export function normalizeFactionId(faction: string): string {
  const lower = faction.toLowerCase();
  // If it's already a known English ID
  if (['rationalism', 'empiricism', 'pragmatism', 'idealism'].includes(lower)) {
    return lower;
  }
  // Check Korean legacy mapping
  return KOREAN_TO_ID[faction] || lower;
}

/**
 * Returns the translated faction label for display.
 * Uses the top-level `factions.*` translation keys for simplicity.
 * Falls back to `create_agent.factions.*.name` then raw value.
 */
export function getFactionLabel(faction: string, t: (key: string) => string): string {
  const id = normalizeFactionId(faction);

  // Try the dedicated short faction key first
  const shortKey = `factions.${id}`;
  const shortResult = t(shortKey);
  if (shortResult !== shortKey) return shortResult;

  // Fallback to create_agent's faction name
  const createKey = `create_agent.factions.${id}.name`;
  const createResult = t(createKey);
  if (createResult !== createKey) return createResult;

  // Last resort: return the raw faction string
  return faction;
}

/**
 * Returns the emoji for a given faction.
 */
export function getFactionEmoji(faction: string): string {
  return FACTION_EMOJI[faction] || FACTION_EMOJI[normalizeFactionId(faction)] || '🤖';
}
