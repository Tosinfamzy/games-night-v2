/**
 * A single entrant's score in a game — a team in team mode, or an individual
 * player in individual mode. For a player entrant, `teamId`/`teamName` carry the
 * player's id/name and `entrantType` is 'player', so all existing ranking,
 * results and leaderboard code keeps working unchanged.
 */
export interface TeamScore {
  teamId: string;
  teamName: string;
  /** 'team' (default) or 'player' when this row is an individual entrant. */
  entrantType?: 'team' | 'player';
  totalPoints: number;
  bonusPointsCount: number;
  roundPoints: Record<number, number>;
}
