const scoreFormula = "score = sqrt(commit ratio x running ratio) x 100";

export function ScoreExplainer() {
  return (
    <details className="score-explainer">
      <summary title="Show how the balanced score is calculated">
        How score works
      </summary>
      <div className="score-explainer-body">
        <p>
          Balanced score compares your commits and running distance with the
          strongest totals in the selected period. Each side becomes a 0-1
          ratio, then the two ratios are combined with a geometric mean.
        </p>
        <code>{scoreFormula}</code>
        <p>
          A zero on either side makes the score 0, so the balanced board rewards
          people who ship code and run.
        </p>
      </div>
    </details>
  );
}
