# Living Companion Architecture

This document describes the companion runtime introduced by `feat/living-companion-architecture`. The design keeps the existing Supabase storage model and adds behavioral structure inside the persisted character-state JSON. No destructive database migration is required.

## Runtime flow

For every conversational reply, the server:

1. Authenticates the user and loads the companion, recent dated messages, knowledge, typed memories, and persisted character state.
2. Upgrades legacy or incomplete character state to the current version with conservative defaults.
3. Detects a local-day boundary in `America/Chicago`, closes or pauses the prior scene, writes a daily reflection, and initializes one stable daily state.
4. Scores memories against the current message. Only the small director-authorized result can reach the generation prompt.
5. Runs the Character Engine once to produce a response direction, optional curiosity/attention decisions, and an observable decision record.
6. Builds a concise prompt in this order: core behavioral identity, director decision, current daily/relationship state, authorized knowledge or memory, a small current-day thread, then mood and voice flavor.
7. Generates a reply and runs the enforced quality/rewrite loop. Unqualified companion text is never persisted.
8. Persists the qualified message first. Character-state updates, memory-recall counters, and knowledge extraction then run asynchronously so they do not delay the reply.

## State layers

- **Core identity:** versioned code configuration. Traits are expressed as behaviors, boundaries, disagreement patterns, humor, curiosity style, and concrete voice rules.
- **Evolving identity:** slowly changing confidence and learned preferences. Per-interaction movement is deliberately small.
- **Inner life:** persistent interests, projects, opinions, and unresolved personal threads. These are stored rather than rerolled on every request.
- **Relationship:** trust, comfort, respect, playfulness, romance, conflict, emotional safety, vulnerability, familiarity, protectiveness, independence, dependency, and repair status. High affinity changes permissions; it does not force affection or disclosure.
- **Daily state:** one deterministic state per local date, including mood dimensions, interaction intent, social energy, conversational appetite, active interests, metaphor budget, and prior-day topic cooldowns.
- **Scene:** active, paused, archived, or closed, with topics and unresolved obligations.

## New-day boundary

A change in the configured local date creates a real conversational boundary. Ordinary scenes are archived; scenes with unresolved obligations are paused. A compact reflection records meaningful events, unresolved loops, and topics that must not be auto-continued. The new day receives a stable daily state and prior topics become cooldowns.

A greeting such as "Good morning" therefore starts a new chapter by default. Previous-day material can return only when Mark explicitly references it or when the retrieval gate identifies a genuine, non-sensitive open loop. General recency is not authorization.

## Memory gate

Memories are represented as factual, episodic, relational, growth, open-loop, or sensitive. Legacy strings are classified conservatively. Retrieval combines lexical relevance, current-context fit, unresolved importance, explicit callback intent, salience, and emotional weight. It subtracts penalties for sensitivity, repeated recall, active cooldowns, and unrequested new-day callbacks.

Generic greetings retrieve nothing except at most one non-sensitive unresolved open loop. Normal turns receive at most two candidates, and conversation generation normally uses one. Sensitive memory is suppressed unless current context provides strong explicit justification.

The runtime continues to use the existing `companion_memories` table. Existing broad knowledge remains available for autonomous/system flows; it is no longer dumped wholesale into normal conversation prompts.

## Fatigue and voice

Recent companion replies are scanned for semantic motif families such as quiet/stillness, light/warmth, carrying/belonging, and atmospheric scene-setting. Repeated families become prompt prohibitions and deterministic quality violations. Prior-day scene topics are separately cooled down.

Seraphine's default is concrete-before-poetic. Distinctiveness should come from observation, dry understatement, choices, boundaries, disagreement, curiosity, and ordinary self-disclosure. Metaphor is optional and controlled by a per-turn budget.

## Quality and evaluation

The deterministic quality layer records structured violation codes for empty acknowledgements, validation-only replies, decorative environment substitution, vague language, poetic overreach, unauthorized callbacks, new-day continuation, self-centered greetings, generic engagement questions, repeated motifs, excessive length, and director mismatch. A failed first response is rewritten and evaluated again; only a passing response is stored.

The offline evaluation harness scores naturalness, directness, relevance, callback appropriateness, topic novelty, lexical variety, identity consistency, emotional proportionality, initiative quality, new-day freshness, memory restraint, and brevity. Regression fixtures cover generic and substantive greetings, explicit callbacks, open loops, sensitive memory, daily stability, scene rollover, DST, initiative suppression, high-trust restraint, disagreement, legacy compatibility, and lexical fatigue.

## Persistence and compatibility

The implementation reuses:

- `companion_character_state.state` for version-2 state JSON;
- existing `companion_memories` fields for typed retrieval metadata;
- existing messages and knowledge storage.

No schema or data migration is introduced. Version-1, partial, malformed, or absent state is adapted at read time and saved in version-2 form after a successful turn. Known relationship values, goals, thoughts, and recent events are retained; new dimensions receive safe defaults.

## Observability and privacy

Per-turn structured logs include day-boundary detection, scene status, daily intent, topic source, selected memory IDs, callback authorization and reason, cooldowns, motif penalties, quality violations, and whether a rewrite was attempted. Logs intentionally omit memory summaries and message content.

## Performance and known limits

The live path performs bounded reads and deterministic in-process scoring; it does not add another model call. State writes, recall bookkeeping, and knowledge extraction are deferred after the response. Retrieval is currently lexical rather than embedding-based, so synonyms without shared concepts may be missed. Database uniqueness and RLS remain production configuration concerns and should be confirmed before rollout. Behavioral fixtures complement, but do not replace, authenticated production smoke testing.
