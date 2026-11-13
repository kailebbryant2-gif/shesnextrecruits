# She's Next College Finder AI (prototype)

An app-style college finder for girls' basketball families. Three required inputs (grade, position, home ZIP), a short
"skill level" section (height, role, evaluator's level, college interest) that powers skill matching, and optional detail.
Parents tap **Find her colleges** to get results; editing the profile afterward offers **Update results**. The guidance engine implements the recruiting methodology documented in `../coach-tay-knowledge-base/`;
every recommendation keeps an internal `src` reference to its knowledge-base entry (not shown in the UI).

## Run
Requires Node 20.6+ and no npm dependencies.

```
cp .env.example .env      # then paste keys into .env (never commit it)
npm run dev               # http://localhost:3000 (reads .env)
npm test                  # engine guardrail tests
```

## Data sources
| Source | Status | Used for |
|---|---|---|
| Quad Data API (usequad.app/developers) | Connected | 4-year colleges near the ZIP (closest first), athletic association + NCAA division + conference (from IPEDS), cost, acceptance rate, net price calculator links |
| College Scorecard (api.data.gov) | Connected | Nearby 2-year colleges as possible junior-college options (Quad has no 2-year colleges) |

What the data can't tell us yet: whether a school has a **women's** basketball program (IPEDS lists "basketball" without gender),
NJCAA membership, rosters, or roster need by position. Every school card says so, and no school is presented as an athletic fit.
Radius options match Quad: 25, 50, 100, 200, 300, 500 miles, closest first. Two-year colleges are limited to 100 miles.

## Guardrails (from the Phase 2 framework)
- Never assigns a division, probability or benchmark. Outputs are labeled *Supported*, *Worth researching* or *Can't tell yet*.
- A level is marked "Explore first" only when the parent reports strong interest from that level (contact, coach watched, visit, offer).
  Mail and camp invites alone never promote a level (FIT-026, FIT-028).
- Height is compared to Coach Tay's size chart as context only, with her overlap caveat (EVAL-052).
- Rule-dependent content (eligibility, calendars) tells families to verify with the governing body.

## Security
API keys live only in `.env` / server environment variables. The browser never receives them.
Rotate any key that has been shared in chat or email.

## Files
- `server.js`: static server + `POST /api/assess` (guidance, no external calls), `GET /api/schools?zip=&radius=` (Quad + Scorecard, cached 1 hour), `GET /api/options`
- `lib/engine.js`: assessment rules (profile, pathways, recommendations, checklist)
- `lib/content.js`: methodology content and size chart, with sources
- `lib/scorecard.js`, `lib/quad.js`: data adapters
- `public/`: questionnaire and results UI

## Deploy (Render)
The repo root has a `render.yaml` Blueprint. In Render: **New → Blueprint**, pick this repo, and enter
`SCORECARD_API_KEY` and `QUAD_API_KEY` when prompted. Render runs `npm start` (keys come from Render's environment),
checks `/healthz`, and redeploys on every push to `main`.
Rate limits per visitor: 240 assessments and 40 school searches per 10 minutes; school results are cached for an hour, so live updates don't spend API calls.

## Skill matching
Per level, the engine scores the evidence the methodology recognizes: coach interest from that level (strong 3 / early 1),
an experienced evaluator naming that level (2), and height in or above the typical range (1). Scores map to
None yet / Limited / Some / Strong; colleges sort by their level's score, then distance. These weights are a product choice,
not published benchmarks. They live in `lib/engine.js` (`WEIGHTS`) and are listed for expert review (questions file Q-071).
