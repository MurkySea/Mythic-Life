# Character Engine v2

Character Engine v2 separates companion behavior from language generation.

The language model writes dialogue. The engine determines the response strategy.

## Pipeline

1. Analyze the user's literal message.
2. Identify likely intent and conversational need.
3. Load the companion's structured Character Studio profile.
4. Load or initialize persistent character state.
5. Select one dominant response move.
6. Compile the decision and state into prompt constraints.
7. Generate dialogue.
8. Validate the reply and update state and memory.

## Current milestone

This branch implements the deterministic core:

- versioned state and relationship types
- default state creation
- deterministic state advancement
- conversation outcome updates
- lightweight intent and need analysis
- profile-driven response decisions
- state-based decision modifiers
- prompt compilation
- unit tests for correction, venting, planning, and low-energy behavior

## Deliberate boundaries

This milestone does not yet persist state to the database or mutate production dialogue behavior. That integration should happen after the deterministic engine compiles and tests cleanly.

The next milestone should:

- add a database migration for companion state
- load state in the conversation route
- pass the engine prompt block into `buildCompanionSystemPrompt`
- update state after a successful reply
- surface live state in Character Studio
- add response validation and memory scoring

## Sustainability rules

- State updates must remain deterministic and cheap.
- No background LLM calls are required to make a companion appear alive.
- Daily state advancement must be computed lazily when the companion is loaded.
- Every stored object is versioned.
- Personality remains in Character Studio; transient condition belongs in Character Engine state.
- Relationship dimensions change slowly and never unlock automatic intimacy.
