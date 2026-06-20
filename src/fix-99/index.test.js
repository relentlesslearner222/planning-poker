import { testFix1 } from './index';

describe('Test fix 1', () => {
  it('should run without errors', () => {
    expect(() => testFix1()).not.toThrow();
  });
});