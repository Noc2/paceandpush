import type { PublicScoreSummary, ScoreSummary } from "@paceandpush/api-contracts";

export function toPublicScoreSummary(score: ScoreSummary): PublicScoreSummary {
  return {
    period: score.period,
    score: score.score,
    rank: score.rank,
    commits: score.commits,
    kilometers: score.kilometers,
  };
}
