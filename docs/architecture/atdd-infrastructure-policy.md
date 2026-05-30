# ATDD Infrastructure Policy

Per `nw-distill` § Project Infrastructure Policy. One file per project. Apply-if-exists; write-if-absent; rewrite with `--policy=fresh`. Git history is the audit trail.

## Driving
| Port | Mechanism | Note |
|---|---|---|
| CLI (chromato start / stop / status) | subprocess via `node dist/index.js` from tmp_path | spawned through helpers.ts `spawnChromato()` |
| NotificationPort (in-process acceptance) | direct construction `new NotificationAdapter(injectedRunner)` | seam injected in unit tests; cucumber acceptance uses skip+manual note for banner verification |

## Driven internal (real)
| Port | Mechanism | Note |
|---|---|---|
| StatePort (state.json) | real filesystem write to tmp_path | `PersistenceAdapter` uses temp dir per test |
| HistoryPort (SQLite) | real better-sqlite3 in-memory or tmp_path | fresh DB per test |

## Driven external / non-deterministic (fake)
| Port | Fake | Note |
|---|---|---|
| NotificationPort OS command runner | `FakeCommandRunner` (injected seam) | captures `{ command, args }` calls; simulates success or failure; never spawns real osascript / notify-send in tests |
| SystemClock | process.hrtime or Date.now in test env | no separate fake needed; timer is driven by `tickOnce()` |
