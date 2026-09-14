import { placementPoints } from './placement.util';

describe('placementPoints', () => {
  describe('placement games (no winner bonus)', () => {
    it('awards 3 / 2 / 1 for the top three, 0 beyond', () => {
      expect(placementPoints(1, null)).toBe(3);
      expect(placementPoints(2, null)).toBe(2);
      expect(placementPoints(3, null)).toBe(1);
      expect(placementPoints(4, null)).toBe(0);
      expect(placementPoints(10, null)).toBe(0);
    });
  });

  describe('winner-bonus games', () => {
    it('pays the flat bonus to 1st place only', () => {
      expect(placementPoints(1, 5)).toBe(5);
      expect(placementPoints(2, 5)).toBe(0);
      expect(placementPoints(3, 5)).toBe(0);
    });

    it('honours a bonus other than 5', () => {
      expect(placementPoints(1, 10)).toBe(10);
    });

    it('treats a bonus of 0 as a real (flat) award, not "no bonus"', () => {
      // 0 != null, so the winner-bonus branch applies: 1st scores 0, not 3.
      expect(placementPoints(1, 0)).toBe(0);
    });
  });
});
