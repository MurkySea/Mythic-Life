# Active Party (max 5)

Finalized 2026-07-25.

## Purpose

The full companion roster can be large.  
Only the **active party** (max 5) receives:

- Leader Trust updates from Rhythm / sleep events
- Priority dialogue and outreach
- Daily effects and Vacation Mode reactions
- Visual presence in the main UI

This keeps cognitive load and emotional bandwidth manageable while still allowing a rich long-term roster.

## Rules

| Rule                        | Value                          |
|-----------------------------|--------------------------------|
| Maximum active members      | **5**                          |
| Leader                      | Exactly one (or zero if empty) |
| First joiner                | Automatically becomes Leader   |
| Leader leaves               | Earliest-joined member promoted |
| Soft lock                   | Optional – blocks join/leave   |

## Pure API (`lib/engines/party.ts`)

```ts
createEmptyParty()
joinParty(party, slug)
leaveParty(party, slug)
setLeader(party, slug)
reorderParty(party, fromIndex, toIndex)
setPartyLocked(party, locked)
validateParty(party)
```

All functions are pure and return a new state (or `null` on invalid transition).

## Integration Notes

- Store `PartyState` on the player record.
- When applying Trust deltas from Rhythm / Vacation Mode, iterate only `party.members`.
- UI should surface the current party of 5 prominently and treat the rest of the roster as “available / reserve”.
- Vacation Mode companions still react, but only active party members generate daily Trust drift and dialogue priority.

## Edge Cases

- Empty party is valid (no Leader).
- Attempting to join a full party returns `null`.
- Locked party rejects all join/leave operations.
- `validateParty` is useful for migrations and tests.
