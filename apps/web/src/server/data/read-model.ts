import {
  seedLeaderboard,
  seedMe,
  seedProfile,
  type Board,
  type LeaderboardResponse,
  type MeResponse,
  type PublicProfileResponse,
} from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";

export function getLeaderboard(
  board: Board = "balanced",
  period = seedLeaderboard.period,
): LeaderboardResponse {
  const sortedRows = [...seedLeaderboard.rows].sort((left, right) => {
    if (board === "commits") return right.commits - left.commits;
    if (board === "distance") return right.kilometers - left.kilometers;
    return right.score - left.score;
  });

  return {
    period,
    board,
    rows: sortedRows.map((row, index) => ({ ...row, rank: index + 1 })),
  };
}

export function getPublicProfile(login: string): PublicProfileResponse | null {
  const row = seedLeaderboard.rows.find(
    (leader) => leader.login.toLowerCase() === login.toLowerCase(),
  );
  if (!row) return null;

  if (row.login.toLowerCase() === seedProfile.login.toLowerCase()) {
    return seedProfile;
  }

  return {
    login: row.login,
    displayName: row.displayName,
    bio: "Healthy body, shipped code.",
    score: {
      period: seedLeaderboard.period,
      score: row.score,
      rank: row.rank,
      commits: row.commits,
      kilometers: row.kilometers,
      lastSyncAt: seedMe.score.lastSyncAt,
    },
    history: seedProfile.history.map((point, index) => ({
      ...point,
      commits: Math.max(0, Math.round((row.commits / 7) * (index + 1))),
      kilometers: Math.round((row.kilometers / 7) * (index + 1) * 10) / 10,
      score: Math.min(row.score, point.score),
    })),
  };
}

export function getMe(sessionUser: SessionUser | null): MeResponse {
  if (!sessionUser) return seedMe;

  return {
    ...seedMe,
    login: sessionUser.login,
    displayName: sessionUser.displayName,
  };
}

export function parseBoard(value: string | null): Board {
  if (value === "commits" || value === "distance" || value === "balanced") {
    return value;
  }
  return "balanced";
}
