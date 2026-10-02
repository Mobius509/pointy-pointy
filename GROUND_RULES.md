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

_None yet._
