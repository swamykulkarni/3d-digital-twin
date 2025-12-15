/**
 * Utility functions for Panel ID validation and extraction
 */

// Panel ID format: PNL-XX-XXX (e.g., "PNL-05-101")
const PANEL_ID_REGEX = /^PNL-\d{2}-\d{3}$/;

/**
 * Validates if a string matches the Panel ID format
 */
export function isValidPanelId(id: string): boolean {
  return PANEL_ID_REGEX.test(id);
}

/**
 * Extracts Panel ID from mesh name
 * Assumes mesh names contain Panel ID somewhere in the string
 */
export function extractPanelIdFromMeshName(meshName: string): string | null {
  const match = meshName.match(/PNL-\d{2}-\d{3}/);
  return match ? match[0] : null;
}

/**
 * Validates Panel ID format and logs warnings for invalid formats
 */
export function validatePanelId(id: string): boolean {
  const isValid = isValidPanelId(id);
  if (!isValid) {
    console.warn(`Invalid Panel ID format: ${id}. Expected format: PNL-XX-XXX`);
  }
  return isValid;
}