import { applyFix99 } from '../src/fixes/fix_issue_99.js';

describe('applyFix99 (Issue #99 - Test fix 1)', () => {
  it('should return an object with fix99Applied set to true', () => {
    const result = applyFix99();
    expect(result.fix99Applied).toBe(true);
  });

  it('should preserve existing context properties', () => {
    const ctx = { user: 'alice', room: 'room-1' };
    const result = applyFix99(ctx);
    expect(result.user).toBe('alice');
    expect(result.room).toBe('room-1');
  });

  it('should include an appliedAt timestamp', () => {
    const result = applyFix99();
    expect(result.appliedAt).toBeTruthy();
  });
});
