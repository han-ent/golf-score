# PRD — FunGolf Simple Scorecard

## Product goal

FunGolf is a Korean, mobile-first, local-only golf scorecard. The phone opens on the current hole. A player records a hole with one tap, can correct 온 and 펏, and keeps the round on the device.

## Core contract

- Product name is FunGolf.
- Default is one player. The same phone can record up to four players.
- Names, the course, and the hole count live in a settings sheet.
- Active storage key remains `fungolf-scorecard:active-round:v1`. Older payloads on that key stay readable. New fields such as assumed putts and penalties are optional.
- Finished rounds are stored separately on the device for average score and greens-in-regulation trend.
- Pressing 온 alone records the standard 2-putt. That default is drawn faintly. A putt the player presses is drawn bold.
- One-tap scores follow the hole par: par 3 is 1/2/3 온 plus 2 펏, par 4 is 2/3/4 온 plus 2 펏, par 5 is 3/4/5 온 plus 2 펏.
- Export is a local PNG. It is not an SVG download and it is not rendered on a server.

## Out of scope

- No betting, settlement, payments, or side games.
- No backend, account, sync, ranking, or social graph.
- No location, maps, forecasts, advice, or coaching.
- No new runtime dependencies.

## Acceptance

1. The first screen is the current hole, in Korean, with no English section labels.
2. Par, bogey, and double record the par-specific 온 and 2 펏, then move to the next player or hole.
3. An 온-only entry stores 2 putts and marks that putt as assumed.
4. Score cells are at least 56px wide and the 온/펏 line is at least 11px.
5. The PNG uses a white background, black text, separate front and back nines, wrapped review text, and a 2x raster.
6. 새 라운드 and 저장 기록 지우기 ask before they erase the current round. The redundant manual save button is absent. Status copy can read 이 기기에 저장됨.
7. A service worker caches same-origin static assets after an online visit. Scores stay in localStorage.
8. Vite `base` is `./`, so a later rename of the GitHub repository does not require a new base path.
