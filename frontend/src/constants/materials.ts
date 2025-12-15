import { StatusType, MaterialConfig } from '../types/index.js';

export const MATERIAL_CONFIG: MaterialConfig = {
  [StatusType.INSTALLED]: { color: '#00ff00' },    // Green
  [StatusType.PENDING]: { color: '#ffff00' },      // Yellow  
  [StatusType.ISSUE]: { color: '#ff0000' },        // Red
  [StatusType.NOT_STARTED]: { color: '#808080' }   // Gray
};

export const DEFAULT_MATERIAL_COLOR = '#808080'; // Gray for panels with no status data