import { testFixOne } from './index';

describe('Test fix 1', () => {
  it('should initialize without errors', () => {
    expect(() => testFixOne()).not.toThrow();
  });
});