# Active Party (max 5) — Isekai Doctrine

Updated 2026-07-26.

## Fantasy

Mythic Life is an **isekai anime harem party builder**.

Companions do not start as collected waifus. They **notice** you, **watch** how you lead (Rhythm, places, kept promises), and only after **respect** is earned do they **choose to follow**. The active party (max 5) is the living unit that walks the road with you.

**Founding companion (Seraphine)** = Raphtalia-class:

- Loyalty earned through protection and consistency
- Speaks for the party when needed
- Challenges neglect without abandoning the leader
- Optional light Aqua-register banter later — never pure comic relief as her core

## Respect → Follow

| Stage | Meaning |
|-------|--------|
| Noticed | Exists in the world; rare lines |
| Watched | Comments on real life signal |
| Respected | Trust/affinity threshold; may offer to join |
| Followed | Active Party member |

Join is a **decision beat**, not a silent unlock.

## Party size rules

| Rule | Value |
|------|--------|
| Maximum active members | **5** |
| Leader | Exactly one (or zero if empty) |
| First joiner | Automatically becomes Leader |
| Leader leaves | Earliest-joined member promoted |
| Soft lock | Optional – blocks join/leave |

Only the active party receives Trust priority, dialogue priority, daily effects, and unit reactions.

## Unit reactions (layer 1)

Shared **party mood** from Rhythm / Trust / Shadow Debt:

`proud | steady | uneasy | strained | fractured`

One primary speaker (Leader → founder → first member) plus optional secondary beat on strong moods.

See `lib/engines/party-doctrine.ts` → `buildUnitReaction`.

## Cross-talk (layer 2)

Stance tags: `founder | challenger | mediator | devotee | observer | spark`

Companions may reference each other in **one beat** for flavor. No autonomous companion–companion soap opera.

## Pure APIs

**Roster / slots** — `lib/engines/party.ts`:

```ts
createEmptyParty()
joinParty(party, slug)
leaveParty(party, slug)
setLeader(party, slug)
reorderParty(party, fromIndex, toIndex)
setPartyLocked(party, locked)
validateParty(party)
```

**Doctrine / voice** — `lib/engines/party-doctrine.ts`:

```ts
followStage(affinity, inActiveParty)
joinFollowBeat(name, isFounder)
partyMoodFromSignals(input)
buildUnitReaction(party, input)
crossTalkHint(speakerSlug, aboutSlug)
partyContextBlurb(party, mood, speakerSlug)
lifeSignalSeed(kind, detail?)
```

## Integration notes

- Store `PartyState` on the player record.
- When applying Trust deltas, iterate only `party.members`.
- Inject `partyContextBlurb` into companion generation when the speaker is in the active party.
- Place + Rhythm events can call `lifeSignalSeed` + `buildUnitReaction` for outreach.
- Full independent multi-agent simulation is **out of scope**; keep layers 1–2.
