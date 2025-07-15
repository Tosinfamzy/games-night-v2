/**
 * Represents a team's score in a game, including total points, bonus points,
 * and points per round.
 */
export interface TeamScore {
  teamId: string;
  teamName: string;
  totalPoints: number;
  bonusPointsCount: number;
  roundPoints: Record<number, number>;
}
