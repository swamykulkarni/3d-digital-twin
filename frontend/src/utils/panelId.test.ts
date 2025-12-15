import { describe, it, expect, vi } from 'vitest';
import { isValidPanelId, extractPanelIdFromMeshName, validatePanelId } from './panelId.js';

describe('Panel ID Utilities', () => {
  describe('isValidPanelId', () => {
    it('should return true for valid Panel IDs', () => {
      expect(isValidPanelId('PNL-05-101')).toBe(true);
      expect(isValidPanelId('PNL-12-999')).toBe(true);
      expect(isValidPanelId('PNL-00-000')).toBe(true);
    });

    it('should return false for invalid Panel IDs', () => {
      expect(isValidPanelId('PNL-5-101')).toBe(false);   // Single digit
      expect(isValidPanelId('PNL-05-1')).toBe(false);    // Single digit
      expect(isValidPanelId('PANEL-05-101')).toBe(false); // Wrong prefix
      expect(isValidPanelId('PNL-05-1011')).toBe(false); // Too many digits
      expect(isValidPanelId('')).toBe(false);            // Empty string
    });
  });

  describe('extractPanelIdFromMeshName', () => {
    it('should extract Panel ID from mesh names', () => {
      expect(extractPanelIdFromMeshName('mesh_PNL-05-101_geometry')).toBe('PNL-05-101');
      expect(extractPanelIdFromMeshName('PNL-12-999')).toBe('PNL-12-999');
      expect(extractPanelIdFromMeshName('building_PNL-00-000_panel')).toBe('PNL-00-000');
    });

    it('should return null for mesh names without valid Panel IDs', () => {
      expect(extractPanelIdFromMeshName('mesh_geometry')).toBe(null);
      expect(extractPanelIdFromMeshName('PNL-5-101')).toBe(null);
      expect(extractPanelIdFromMeshName('')).toBe(null);
    });
  });

  describe('validatePanelId', () => {
    it('should return true and not log for valid Panel IDs', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(validatePanelId('PNL-05-101')).toBe(true);
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should return false and log warning for invalid Panel IDs', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(validatePanelId('invalid-id')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Invalid Panel ID format: invalid-id. Expected format: PNL-XX-XXX');
      
      consoleSpy.mockRestore();
    });
  });
});