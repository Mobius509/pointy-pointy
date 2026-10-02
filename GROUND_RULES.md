# Pointy Points — ground rules

The rules every change follows, for people and for Claude. Add to the list
as they come up; keep each one short, with what it means in practice.

## 1. Web and iOS stay in sync

The web app (`src/`) and the iOS app (`ios/`) are one product. A feature,
fix, rule or piece of copy that changes on one should change on the other.

- **Plan both.** When a change touches what a kid or parent sees or can do,
  say how it lands on web *and* iOS before building — and build both, or
  note the iOS follow-up explicitly.
- **Shared logic lives on the server.** Game rules, points, streaks, tickets
  and permissions are decided in server code / API routes both apps call,
  not re-implemented per platform.
- **Deviations are called out and verified.** If one platform needs to
  differ (a platform limitation, a native pattern like iOS confirmation
  dialogs vs. our web Dialog, a feature not ported yet), say so up front,
  explain why, and get a yes before going ahead. Record agreed deviations
  below.
- **Check both before calling it done.** Verify the change on web and in the
  iOS simulator (or say plainly what wasn't checked).

### Agreed deviations

- **Celebrations and mini games on iOS run the web versions** (2026-10-02).
  The iOS app shows the web celebration (`/h/<slug>/celebrate`) and arcade
  (`/h/<slug>/arcade`) in a signed-in web view (`WebPlayView`, via
  `/api/v2/kid/web-session`) until native versions are built. Goal: native
  parity later.

## 2. Live and in-progress work stay on separate branches

- **`main` is the live site** — pushing it deploys. It only gets finished,
  verified work, with a go-ahead.
- **Big in-progress work gets its own branch** (kid app 2.0: `kid-app-2`), so
  it never rides along with a live fix.
- **A fix for the live site** branches from `main`, ships to `main`, then
  `main` is merged into the in-progress branch so nothing drifts.
