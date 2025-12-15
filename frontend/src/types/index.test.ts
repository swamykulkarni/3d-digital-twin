import { describe, it, expect } from 'vitest';
import { StatusType } from './index.js';

describe('Types', () => {
  it('should have correct StatusType enum values', () => {
    expect(StatusType.INSTALLED).toBe('INSTALLED');
    expect(StatusType.PENDING).toBe('PENDING');
    expect(StatusType.ISSUE).toBe('ISSUE');
    expect(StatusType.NOT_STARTED).toBe('NOT_STARTED');
  });
});