import {
  weeklyCommitPlateau,
  weeklyKilometerPlateau,
} from "@paceandpush/api-contracts";

const componentFormula = "component = 1 - 25^(-activity / period plateau)";
const scoreFormula = "score = 100 x sqrt(commit component x run component)";

export function ScoreExplainer() {
  return (
    <details className="score-explainer">
      <summary title="Show how the balanced score is calculated">
        How score works
      </summary>
      <div className="score-explainer-body">
        <p>
          Your score depends only on your activity. Each selected period uses
          fixed plateaus equivalent to {weeklyCommitPlateau} commits and{" "}
          {weeklyKilometerPlateau} km per week.
        </p>
        <code>{componentFormula}</code>
        <code>{scoreFormula}</code>
        <p>
          Half a plateau earns 80 on that component; reaching it earns 96.
          Extra activity has diminishing returns, other users cannot change
          your score, and zero on either side makes the balanced score zero.
        </p>
      </div>
    </details>
  );
}
