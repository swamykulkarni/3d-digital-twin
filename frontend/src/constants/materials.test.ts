import { describe, it, expect } from 'vitest';
import { MATERIAL_CONFIG, DEFAULT_MATERIAL_COLOR } from './materials.js';
import { StatusType } from '../types/index.js';

describe('Material Configuration', () => {
  it('should have correct color values for each status type', () => {
    expect(MATERIAL_CONFIG[StatusType.INSTALLED].color).toBe('#00ff00'); // Green
    expect(MATERIAL_CONFIG[StatusType.PENDING].color).toBe('#ffff00');   // Yellow
    expect(MATERIAL_CONFIG[StatusType.ISSUE].color).toBe('#ff0000');     // Red
    expect(MATERIAL_CONFIG[StatusType.NOT_STARTED].color).toBe('#808080'); // Gray
  });

  it('should have correct default material color', () => {
    expect(DEFAULT_MATERIAL_COLOR).toBe('#808080'); // Gray
  });
});