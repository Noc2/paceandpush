# Pace & Push — Product Idea Design Review

Date: 2026-07-11

Scope: this review evaluates the **idea** of Pace & Push — the balanced
code-plus-running leaderboard as a product concept — not the implementation.
It was produced by a multi-agent review: eight parallel reviewers (value
proposition, scoring/incentives, competition, cold start, retention,
trust/safety, inclusivity/expansion, sustainability), each doing independent
web research; a three-lens adversarial challenge panel (founder steelman,
evidence checker, prioritization skeptic) that judged every weakness; and a
completeness critic hunting for missed angles. Of 51 weaknesses raised, 32
were confirmed by the challenge panel, 19 were contested (real but overstated
for a pre-launch solo indie project), and 0 were refuted outright.

## Executive summary

The core concept is genuinely novel and well-branded, sits in verified white
space, and owns one proven distribution channel (the GitHub README embed).
But as currently shaped — one global leaderboard, cohort-max-normalized
scoring, native-app-gated participation, unresolved privacy default — the
product is optimized against its own survival. The consistent conclusion
across independent reviewers:

1. **The leaderboard cannot be the hero at launch.** The realistic engaged
   audience (GitHub-active ∧ runs ∧ tracks into HealthKit/Health Connect ∧
   installs a niche app ∧ accepts public ranking) is plausibly low-thousands
   worldwide, and a global leaderboard is the product shape most dependent on
   crowd density. The README embed and personal/single-player value work at
   n=1 and should lead; the board should be something you grow into.
2. **The scoring formula, as specified, undermines the product.** Cohort-max
   normalization makes every score outlier-dominated, non-monotonic (your
   number drops when a stranger joins), unexplainable, and cheat-contagious.
   The geometric mean hands every newcomer — and every injured or vacationing
   user — a public zero. Both inputs are trivially forgeable. This is the
   most fixable of the critical problems, and several concrete fixes exist.
3. **The privacy default was the product's central unresolved decision and is
   now resolved private-first.** GitHub connection and the first aggregate
   health sync remain private. Publishing exact period totals requires a
   separate versioned confirmation that names the audience and fields, while
   dated activity history is an independent default-off choice. The remaining
   work is real-device and store-review evidence, not ambiguity in the product
   behavior.
4. **One existential risk sits upstream of everything: app-store health-data
   policy.** Apple's guideline 5.1.3 and Google's Health Connect permitted-use
   policy restrict how HealthKit/Health Connect-derived data may be exposed.
   "Publish users' running distance on a public leaderboard" is exactly the
   shape reviewers scrutinize hardest. The private-first, express-consent
   design materially reduces this risk without removing exact kilometers, but
   approval is still an external gate and not guaranteed by implementation.

The good news: the reviewers converged not just on the problems but on the
same small set of fixes — embed-first positioning, fixed-anchor or
active-days scoring, small leagues, opt-in granular privacy, rest mechanics,
and structural anti-cheat — and most are cheap relative to what is already
built.

## What is strong about the idea

- **Verified white space.** Extensive searching found a crowded micro-genre
  of commits-only leaderboards (committers.top, ghcommits.com, commitrank.dev)
  and coding-time boards (WakaTime), but no product combining code output and
  physical training into one score. The balanced score is novel, memorable,
  and explainable in one sentence.
- **The README embed rides a proven, enormous channel.**
  anuraghazra/github-readme-stats (~80k stars) proved developers eagerly
  paste third-party SVG stat cards into their profiles. Every embed is a
  permanent free ad on the highest-traffic surface where the exact target
  audience lives — and it provides single-player value at n=1.
- **Skipping Strava was validated platform judgment.** Strava's API terms
  (restricting display of a user's data to that user only, effective June
  2026) killed exactly this category of third-party app. HealthKit/Health
  Connect sourcing is structurally correct, free, revocation-proof, and
  forces any copycat to ship two native apps. It also creates a recruitable
  audience of Strava-API refugees.
- **The geometric mean enforces the thesis.** An arithmetic mean would let a
  200-commit couch-dweller rank mid-board; sqrt(commits × km) cannot be won
  one-dimensionally. The "balanced" positioning is enforced by math, not just
  marketing (the problems are with normalization and zero-handling, not the
  mean itself).
- **The brand fits the audience unusually well.** The "healthy hacker"
  counter-identity — pushing back on green-square grind culture while
  speaking developer idiom — is culturally resonant, and the terminal-prompt
  aesthetic translates perfectly to an SVG embed. No incumbent owns this
  identity.
- **No GPS routes is the single best trust decision in the design.** Daily
  distance summaries structurally avoid the worst Strava failure modes
  (route-based stalking, home-address inference, the 2018 heatmap incident).
  This should be marketed, not buried in a policy page.
- **Near-zero variable cost, no rent-seeking dependency.** Tiny payloads,
  user-quota GitHub fetches, Vercel + Neon comfortably hosting thousands of
  users — sustainability is a labor question, not a hosting-bill question.
- **Passive data capture on both axes.** The score accrues without manual
  logging, so a lapse in opening the app is not a lapse in participation —
  the failure mode that kills most fitness apps.

## Critical weaknesses (confirmed by the challenge panel)

### 1. The audience is thousands, not millions — and a global leaderboard is the shape most dependent on liquidity

The participation funnel multiplies hard filters: active GitHub developer ×
regular runner × tracks runs into Apple Health/Health Connect × willing to
install a niche native app × willing to be publicly ranked on both code
output and body. Stack Overflow wellness data suggests under half of
developers prioritize exercise at all, with walking (not running) the most
common form. The engaged weekly-syncing intersection is plausibly
low-thousands worldwide at maturity — and at least five commits-only
leaderboards already exist as traction-less hobby toys, suggesting the
standalone-leaderboard genre has a short novelty half-life. A board of 40
strangers feels dead, and being #23 of 60 means nothing. The idea's
viability hinges on a job-to-be-done that works at n=1 or n=20; a global
rank as hero does not have one. (The steelman notes low-thousands of engaged
users is a *successful* outcome for a solo indie project — but only if the
product's core loop works at that scale, which the current design does not.)

### 2. Cohort-max normalization breaks the score — resolved

Resolved on 2026-07-12: scoring now uses published weekly plateaus of 25
commits and 50 km, scaled to the complete selected period with a saturating
curve. Numeric scores depend only on the user's own activity. The analysis
below documents the removed PoC formula.

`normalizeMetric(value, max) = min(value/max, 1)` over the visible cohort
means: one 160 km/week ultramarathoner or one 800-commit bot silently
rescales the entire board; your score drops when a stranger joins or cheats
(cheating has negative externalities on every honest user); "run 5 more km"
has no computable effect; and the README embed — the growth loop — displays
a number that fluctuates because of other people's behavior, which reads as
a bug. At small N the metric degenerates completely: whoever leads both axes
scores exactly 100 and everyone else is noise anchored to that one person.
First-impression score stability matters most exactly when N is smallest.

### 3. Both inputs are near-zero-cost to forge, and rank integrity IS the product

Commit count is the single most-gamed developer metric in existence —
fake-git-history, github-activity-generator, and `git commit --allow-empty`
in a loop all produce numbers GitHub's API reports faithfully. HealthKit and
Health Connect both accept manual entries: anyone can type "ran 21 km" into
the Health app. The flagship metric is thus the product of two trivially
forgeable numbers, defended by one heuristic ("implausible daily distance
flagged for review") adjudicated by a solo developer. Strava (digital-EPO
GPX doctoring) and Zwift (weight doping severe enough to need a standing
anti-doping body) show even staffed platforms bleed leaderboard credibility
to a sub-1% cheater minority. A public board whose top 10 is visibly fake
within weeks of traction is dead. Notably, structural mitigations exist and
are unused: HealthKit exposes `HKMetadataKeyWasUserEntered` and per-sample
source; Health Connect exposes the writing app.

### 4. No social graph, invites, friends, teams, or leagues anywhere in the design

The docs contain zero mention of friends, follows, invites, teams, or
challenges — the only competitive surface is one global board. That means no
reason for user #40 to bring user #41 (K-factor ≈ 0 outside the embed) and
no "atomic network" unit. Every comparable success converged on the same
answer: Strava grew by activating clubs, Duolingo runs ~30-person leagues,
WakaTime's most-requested feature was private leaderboards. A 10-person
dev-team league is complete and fun on day one; a global board with 15
strangers is a ghost town. Reviewers across four dimensions independently
named small leagues the single highest-leverage design change.

### 5. The activation funnel multiplies four brutal filters before first value

Participation requires: be in the niche intersection → web-to-app-store
install (single-digit percent for niche apps) → GitHub OAuth in a native app
→ health-permission grant (~20% baseline denial) → first sync. Compounding
conservatively, under ~5% of interested visitors become scored members — an
HN front-page spike of 30k visits might yield a few hundred. Every
successful comparable is near-zero-friction (github-readme-stats is
paste-a-URL; WakaTime is install-a-plugin). Web GitHub sign-in already
exists, yet there is no "join on web now, add running later" partial
activation path that banks a visitor before the app-install wall.

### 6. The retention model is one global leaderboard, which retains only the top decile

Gamification research is unambiguous: global boards motivate roughly the top
5–10% and accumulate perceived repeated failure for everyone else. In week
6, the user at rank 187 with no path upward has nothing to come back for —
the design gives them no other loop (no personal records, achievements,
digests, widgets; a streak-days stat exists in code but is not framed as a
mechanic). Strava survives by decomposing competition into thousands of tiny
ponds (segments, clubs, Local Legends); this design has one big pond of
strangers.

### 7. The geometric mean turns every life interruption into a public score wipeout

A running injury, illness, vacation, parental leave, or work crunch zeroes
the balanced score entirely — all the commits in the world cannot offset
km = 0. Runners get injured constantly; for the core audience this is a
certainty within months, not an edge case. There are no grace mechanics: no
rest-day allowance, no freeze, no injury mode, no rolling window. Duolingo's
data shows streak freezes alone cut churn 21% for at-risk users. The first
two-week interruption is the churn event for most users, and re-entry after
watching your public rank crater is the hardest ask in the category.

### 8. Public-by-default health data tied to real identities — and the docs cannot agree

`implementation-plan.md` lines 19 and 107 say public-by-default with
opt-out; line 312 says opt-in. This is not a docs nit — it is the product's
central trust decision left unresolved, and it directly gates the viral
loop (an opt-in board is emptier; a public-by-default board is an HN
scandal). Precedent points one way: WakaTime's public board is opt-in and
still works; GitHub hides private-contribution counts by default; Strava's
public-by-default Flyby had to be neutered after stalking reports. If the
top comment on the launch thread is about a privacy default, the launch is
lost.

### 9. (New — completeness critic) App-store health-data policy may block the product shape outright

Apple's guideline 5.1.3 restricts sharing HealthKit data with third parties
and scrutinizes apps whose primary purpose is publishing health data;
Google's Health Connect access requires declaration and approval against a
permitted-use policy limiting how derived data is exposed. "Publicly rank
strangers by their HealthKit running distance" is the use-case shape
reviewers reject or later revoke — a binary, existential risk sitting
upstream of every other finding. It deserves explicit de-risking (review
notes, pre-submission inquiry, or a design that keeps public surfaces fed by
clearly-consented, user-owned aggregates) before further investment.

## Major weaknesses (confirmed)

- **Commit count is a ridiculed, structurally unfair metric for this exact
  audience.** Green-square farming is an open joke among developers; squash
  merge undercounts enterprise devs 5–10× versus atomic committers for
  identical output; review/triage/PR work — the work of senior engineers —
  counts for nothing; and AI-era commit inflation is decoupling the metric
  from effort further. GitHub's GraphQL `contributionsCollection` (commits +
  PRs + reviews + issues) is the same API family and fixes most of this in
  one change.
- **The incentive design punishes rest — the opposite of the brand.** GitHub
  itself removed contribution streaks in 2016 after community pressure that
  daily-activity gamification punished rest (the natural experiment is
  documented in arXiv 2006.02371). This product re-adds that pressure,
  multiplies it by a running requirement, and makes it public. "Run. Commit.
  Repeat." is one screenshot away from being read as hustle-culture satire —
  the "gamified burnout" identity, once attached, is very hard to shed.
  Ironically the intent (balance) is the opposite; the math just doesn't
  encode it: more of both is always better, with no concept of recovery.
- **Publishing private-contribution aggregates leaks employer work
  patterns.** A public per-week commit series tied to a named engineer makes
  sick days, notice periods, and job searches legible to managers and
  recruiters. GitHub defaults private contributions to hidden for exactly
  this reason. Include-private should be a separate, clearly-worded opt-in.
- **Distance-only scoring rewards junk volume.** Cohort-max km normalization
  means a healthy 25 km/week runner normalizes to ~0.15 against one
  160 km/week ultramarathoner; effort, elevation, and pace count for
  nothing. The winning strategy on the balanced board — maximal slow mileage
  plus micro-commits — is precisely the behavior the product claims to
  reject.
- **The category graveyard is real.** Sourcerer shut down; Hack Club's
  WakaTime leaderboard is archived; CodersRank survived only by pivoting to
  B2B recruiting; commit boards are abandoned toys. The known decay curve —
  great Show-HN day, week of sign-ups, ghost town once ranks stabilize — is
  exactly what the current design (no seasons, no cohorts, no accrual layer)
  does not counter.
- **Squeezed between two identity-owning giants.** The runner identity lives
  on Strava (developer run clubs already exist there); the coder-status
  identity lives on GitHub itself. A Strava club plus a README badge is 90%
  of the value at 0% switching cost. The product must make its unique asset
  (the balanced score) visible where developers already are — the embed —
  or it loses by ambient gravity, without either giant trying.
- **No launch/acquisition plan exists.** The launch docs are 100%
  operational (TestFlight, migrations, rollback). Nothing on Show HN,
  Product Hunt, community seeding, a founding cohort, or how the first 20
  profiles get populated so the public board isn't self-falsifying on day
  one. For a leaderboard product, the seeding strategy is as load-bearing as
  the code.
- **Trust in moderation is one person deep.** A solo developer manually
  adjudicating strangers' flagged health data is unscalable and reads as
  creepy. Auto-hide plus structural filters (below) fixes this cheaply.
- **Four-platform maintenance for one person.** Web + backend + SwiftUI +
  Kotlin/Compose is a 3–4 person footprint. The dollar costs are trivial;
  the ~10–20 hrs/month of platform-treadmill labor, unpaid, indefinitely, is
  what actually ends projects like this. Comparable sustainable indies
  (Exist.io) run this stack only because subscriptions fund full-time work.

## New angles from the completeness critic

Beyond the app-store policy risk (critical #9 above):

- **Regulatory exposure, including minors.** HealthKit-derived running data
  is GDPR Article 9 special-category data (explicit consent, erasure,
  records-of-processing for EU users) and covered by laws like Washington's
  My Health My Data Act (private right of action). GitHub allows accounts at
  13 and the design has no age gate — so as specified, the product can
  publicly publish health-derived data about minors. Delete flows are not a
  compliance posture; a legal basis, geo-aware consent, and an age gate are.
- **The backend is a breach honeypot.** GitHub OAuth tokens (with
  private-contribution scope) joined to daily health time series and real
  professional identities, on hobby infrastructure, with no stated security
  program (token encryption at rest, rotation, audit logging, incident
  response, breach notification). The worst case is not churn — it is a
  breach that leaks employer-linkable health data.
- **Seasonality couples every score to the weather.** Running collapses in
  northern winters; hemispheres are out of phase. Under cohort normalization
  on one global board, identical effort scores differently by season, and a
  synchronized Q1 score decay across the majority-northern user base is a
  predictable annual retention trough. Hemisphere-aware cohorts, seasons as
  a designed feature, or weather-robust metrics are all unexplored.
- **Honest data will be wrong, not just forged data.** HealthKit/Health
  Connect pathologies: the same run written by watch + phone + app double- or
  triple-counts unless deduplicated by source; watches sync days late, so
  "closed" weekly boards get retroactively invalidated; users can
  legitimately edit past workouts, making standings mutable. And many
  serious runners' data lives in Garmin/Strava and never reaches Health
  Connect at all — the most credible runners may show zero km.
- **No internationalization thinking.** Kilometers are hard-coded into the
  metric, copy, and brand — but the largest developer population (the US)
  thinks in miles. Health Connect/Play are degraded or absent in some large
  markets; week-start conventions differ; the "global" board is global in
  name only.

## Contested findings (raised, but judged overstated for a pre-launch solo project)

The challenge panel pushed back hardest on venture-scale framing. Worth
recording so future-you doesn't re-litigate them:

- **"No durable moat / WakaTime clones it in a sprint."** A market of
  thousands is too small for an incumbent to bother with; solo projects need
  a defensible niche community, not a moat. Clone risk only activates after
  traction — a problem worth having.
- **"No repeat-visit loop / nothing accrues."** Partly contradicted by code
  (a streak-days mechanic exists in `apps/web/src/lib/streaks.ts`) and
  partly correct MVP sequencing — though one or two sub-rank loops (personal
  bests, weekly recap) should ship near launch.
- **"README embed is a cost time bomb."** The github-readme-stats analogy
  fails on mechanism: that project calls GitHub's rate-limited API per
  render; Pace & Push serves precomputed scores. With daily static renders +
  CDN caching (+ GitHub's Camo cache in front), viewer-scaled cost becomes
  user-scaled. Fix by design pre-launch; not a bomb.
- **"Moderation is unbounded labor."** Bounded by design choices: auto-hide
  flagged entries, exclude manual entries at ingest, GitHub-OAuth gating
  kills spam signups. Minutes per week at launch scale.
- **"No monetization is the highest-risk decision."** At year-one scale the
  product survives fine as a free side project; monetization is a year-two
  question. (Declaring the posture publicly is still cheap and worth doing.)
- **"Running-only narrows the niche" / "no expansion roadmap."** Narrow
  wedges are correct indie strategy (Strava launched cycling-only); the
  wheelchair-workout inclusion is the one concrete piece to adopt now.
- **"Period-boundary timezone misalignment."** Real, bounded to a few hours
  a week, below natural variance. Engineering footnote.
- **"Pseudonymity missing" / "health-status inference channel."** Real
  concerns with cheap, available mitigations (display-name layer; publish
  bands and period totals rather than daily series; noindex by default) —
  design refinements, not concept flaws.

## Recommendations, in priority order

The reviewers converged independently on a small set of moves. Ordered by
leverage:

1. **De-risk app-store approvability first.** The implementation now provides
   private-first sync, exact-field preview, versioned express consent,
   separate dated-history consent, immediate withdrawal, and matching review
   notes. Submit those facts in TestFlight/App Review and Play declarations;
   use developer support or a pre-submission inquiry if available. Keep exact
   period kilometers because they are core product value, but treat approval
   as an external release gate and retain a score-only fallback design.
2. **Invert the product: embed first, board second.** Position as
   "github-readme-stats for your code AND your body." A beautiful
   dual-sparkline card works at n=1, rides an 80k-star-proven channel, and
   converts the biggest weakness (leaderboard cold start) into the
   acquisition loop. Copy the playbook: generate a card from public GitHub
   data alone with the running half showing "connect the app to complete
   your score" — the half-empty card is itself the install CTA. Open-source
   the card repo; get on the awesome-profile-readme lists.
3. **Fix the score.** Replace cohort-max normalization with fixed, published
   saturating anchors (km plateauing ~50–60 km/week; commits/contributions
   plateauing ~20–25/week) or score active days (0–7 per axis, capped at
   5–6 to reward rest). Fixed anchors make the score monotonic in your own
   effort, stable in embeds, immune to outliers and cheaters, and
   self-explainable — and the plateau is itself the cheapest anti-Goodhart
   and anti-overtraining device. Show the components and a what-if ("one
   more run → +4.1") on every profile.
4. **Ship small leagues before public launch.** Invite-link friend leagues
   (5–30 people), team/company boards, and optionally Duolingo-style
   auto-leagues by score band. This converts the atomic network from
   "thousands of strangers" to "one dev team," creates the missing invite
   loop, contains any cheater's blast radius to 29 people, and is the only
   proven leaderboard form at launch scale. It is also the future B2B
   monetization wedge if one is ever wanted.
5. **Privacy is now opt-in and partially granular; make it the brand.**
   Onboarding connects and syncs privately, then presents an exact-field
   publication preview. Public identity, exact period kilometers, commits,
   score, rank, streak, bio, and last-sync time form one understandable
   summary consent because splitting them would break the core leaderboard.
   Dated cumulative history is a separate default-off consent because it can
   reveal day-to-day activity. "Nothing is public until you say so" should be
   the launch message. Alias/noindex controls remain useful follow-up work.
6. **Build rest into the mechanics and market the anti-burnout position.**
   Rolling 28-day windows (or decay) instead of hard zeroing; freeze/injury
   tokens; a creditable-days cap so rest is score-neutral. Then say it
   loudly: "the only developer leaderboard you can't win from your desk —
   or by never leaving it." This preempts the inevitable gamified-burnout
   critique by making the opposite claim falsifiable in the formula, and it
   is the most differentiated story available for launch coverage.
7. **Make anti-cheat structural and visible.** Exclude
   `HKMetadataKeyWasUserEntered` workouts from board credit by default;
   badge watch/app-recorded entries as verified; require GitHub account age
   or activity floors; auto-hide implausible entries with self-serve appeal;
   publish the integrity rules. "Verified data only" is a marketing
   differentiator against Strava's cheating discourse, and it removes the
   solo-dev-reviews-your-workout dynamic entirely.
8. **Widen the cheap axes now, stay running-flavored.** Accept walking,
   hiking, and wheelchair-push distance at launch (same daily-distance
   summaries, near-zero engineering; wheelchair parity converts the most
   damaging launch criticism into a values statement). Switch the developer
   axis from raw commits to GitHub's `contributionsCollection`. Support
   miles. Publish a one-page expansion roadmap (v2: active-minutes so gym
   and climbing count; v3: GitLab) so every excluded group becomes a
   waitlist instead of a critic.
9. **Write the launch playbook — the seeding is as load-bearing as the
   code.** Hand-recruit a 50–100 person founding cohort (permanent badge)
   from dev-runner niches; launch as a time-boxed seasonal event
   ("Commit & K's October" — badge for N balanced weeks) rather than a
   standing board, so scarcity reads as a feature and 400 participants feel
   alive; lead with a data story ("Do developers who run ship more?") for
   HN; add web-first partial activation (GitHub OAuth on web → commits-only
   rank + embed immediately, app install as step 2); add an email/handle
   capture for desktop visitors. Recruit the Strava-API refugees explicitly.
10. **Declare the sustainability posture and cap the labor.** Publicly:
    sustainably-free core + monkeytype-style supporter tier (flair on the
    board/embed, custom themes) and/or WakaTime-style history gating later.
    Render embeds as scheduled static SVGs behind long-TTL CDN caching.
    Publish a sunset pledge (if unmaintained: public surfaces go dark, data
    deleted, domain not sold with data) — for a solo health-data product,
    "here is exactly what happens if I stop" is the cheapest credibility
    available. Add an age gate, and treat token encryption, scope
    minimization, and breach response as launch-blocking security work, not
    ops polish.
11. **Handle the data honestly.** Dedupe multi-source workouts by recording
    source; hold weekly boards open for late watch syncs (or mark standings
    provisional for 48h); decide the policy for retro-edited workouts; and
    document the Garmin/Strava gap so zero-km serious runners understand
    why. Season design (hemisphere-aware cohorts or seasonal events) turns
    the Q1 trough into a January "fresh start" event instead.

## The one-sentence version

The idea deserves to exist — the intersection is real, the white space is
verified, and the brand is right — but it should launch as a single-player
identity product (embed + personal score + small leagues) with an honest,
opt-in, rest-respecting score, and let the global leaderboard be the reward
for traction rather than the bet placed on day one.

## Selected evidence

Distribution and comparables:

- github-readme-stats (~80k stars, the embed playbook and its Vercel
  rate-limit failure): https://github.com/anuraghazra/github-readme-stats,
  https://github.com/anuraghazra/github-readme-stats/issues/4748
- WakaTime leaderboards (opt-in public; private boards by demand; ~$660K/yr
  bootstrapped): https://wakatime.com/leaders,
  https://wakatime.com/blog/24-private-leaderboards
- Commit-leaderboard graveyard: https://committers.top/,
  https://ghcommits.com/, Sourcerer shutdown
  (https://github.com/sourcerer-io/sourcerer-app), commits.top lapsed into
  casino spam
- Strava API restrictions validating the HealthKit choice:
  https://press.strava.com/articles/updates-to-stravas-api-agreement,
  https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html

Scoring, incentives, and integrity:

- GitHub streak removal and its behavioral study:
  https://github.com/dear-github/dear-github/issues/163,
  https://arxiv.org/abs/2006.02371
- Commit-graph gaming tools: https://github.com/artiebits/fake-git-history,
  https://github.com/Shpota/github-activity-generator
- Fitness-leaderboard cheating precedents: Strava digital EPO
  (https://road.cc/content/news/84868), Zwift/ZADA weight doping
  (https://www.cyclingweekly.com/news/product-news/how-fair-is-zwift-racing-455774)
- Manual HealthKit entry (and the unused `HKMetadataKeyWasUserEntered`
  mitigation): https://support.apple.com/en-us/108779

Retention and gamification:

- Duolingo: ~30-person leagues; streak freeze cut at-risk churn 21%:
  https://blog.duolingo.com/how-duolingo-streak-builds-habit/
- Global leaderboards demotivate the bottom 90%:
  https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/
- Strava Local Legends (consistency over volume, retains the middle):
  https://support.strava.com/hc/en-us/articles/360043099552-Local-Legends
- UCL 2025 on fitness-app streak shame/avoidance:
  https://www.ucl.ac.uk/news/2025/oct/emotional-strain-fitness-and-calorie-counting-apps-revealed

Trust, privacy, policy:

- Strava heatmap incident (aggregate non-route data still leaks):
  https://www.engadget.com/2018-03-13-after-exposing-secret-military-bases-strava-restricts-data-visi.html
- Apple health-data rules (5.1.3):
  https://developer.apple.com/app-store/review/guidelines/#health-and-health-research
- Google Play health permissions / Health Connect policy:
  https://support.google.com/googleplay/android-developer/answer/12991134
- Developer sentiment on commit metrics (~10% effort correlation):
  https://getdx.com/blog/measuring-developer-activity/

Market sizing and expansion:

- Stack Overflow developer wellness (~47% prioritize exercise; walking most
  common):
  https://stackoverflow.blog/2022/05/09/new-data-developers-and-prioritizing-wellness-at-work/
- Apple wheelchair push workouts (inclusion is a product choice):
  https://support.apple.com/guide/watch/apd356e8c92e/watchos
- Sustainable-indie models: https://monkeytype.com/ (supporter-funded free
  leaderboard), https://adventofcode.com/2025/sponsors (sponsored free dev
  event), https://exist.io/blog/the-way-we-run-exist/ (subscription-funded
  small team)
