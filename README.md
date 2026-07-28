# Mythic Life

Mythic Life is a private, dark-fantasy productivity RPG that turns real-world effort into character progression.

Tasks, routines, health rhythms, goals, and personal choices feed a connected game system built around XP, gold, Shadow Debt, skills, companions, memories, scenes, dates, and relationship growth. The goal is not to place a fantasy skin over a checklist. It is to make daily progress feel like living inside an evolving personal RPG.

> **Project status:** Active personal project under rapid development. The application and data model are evolving frequently.

## Core Experience

- Complete real tasks and routines to earn progress and rewards.
- Track goals, daily rhythm, health signals, and longer-term consistency.
- Build relationships with companions through trust, intimacy, choices, dates, scenes, and remembered interactions.
- Let companion behavior change based on what they learn about the player.
- Use game systems such as Shadow Debt, currencies, progression, and rewards to make real-life momentum visible.
- Generate and preserve companion scenes and artwork in an in-app gallery.

## Current Systems

The project currently includes or is actively developing:

- Daily task and routine management
- XP, gold, currencies, and reward loops
- Personal goals and progress tracking
- Health and sleep rhythm scoring
- Personal baseline progression
- Shadow Debt and rhythm consequences
- Companions and party management
- Trust and intimacy relationship axes
- Companion messages and response choices
- Persistent companion memories
- Memory-aware dialogue, dates, and scene prompts
- Date nights and generated images
- Gallery and companion avatar selection
- Push notifications
- Password-gated private access

## Architecture

Mythic Life is split across two repositories:

### `MurkySea/Mythic-Life`

The primary application. It contains the user interface, game systems, companion logic, progression engines, server actions, Supabase integration, and application routes.

### `MurkySea/mythic_life_data`

A separate private data service used to receive and expose personal health and device data to Mythic Life through authenticated server-to-server requests.

At a high level:

```text
Personal health/device data
        ↓
mythic_life_data
        ↓ authenticated request
Mythic-Life scoring and game engines
        ↓
Rhythm, goals, rewards, Shadow Debt, and companions
```

## Technology

- [Next.js](https://nextjs.org/) 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Vitest
- Web Push

## Local Development

### Requirements

- Node.js 20 or newer recommended
- npm
- A configured Supabase project
- Required environment variables for the services used by the app

### Install

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Available Commands

```bash
npm run dev        # Start the local development server
npm run build      # Create a production build
npm run start      # Start the production server
npm run lint       # Run ESLint
npm run test       # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
```

## Configuration

The application depends on private credentials and service configuration, including Supabase and optional integrations used for personal data, generated content, notifications, and access control.

Do not commit secrets to the repository. Store local values in an ignored environment file and configure production values through the deployment provider.

Because the project is changing quickly, the source code and deployment configuration remain the authoritative reference for the exact environment variables currently required.

## Development Principles

### Real life remains authoritative

The game should reward meaningful real-world behavior rather than encourage meaningless clicking or grinding.

### Companions should remember and respond

Memory should affect future behavior, dialogue, choices, scenes, and relationship development—not merely appear as stored trivia.

### Progression should be understandable

Players should be able to see why a reward, penalty, relationship change, or progression event occurred.

### Systems should remain connected

Tasks, health, goals, relationships, story, and rewards should reinforce one another without becoming impossible to reason about or balance.

### Privacy comes first

This project handles personal routines, relationship interactions, and health-related data. Private information and credentials must remain protected across both repositories and deployments.

## Repository Safety

Before merging a change:

```bash
npm run lint
npm run test
npm run build
```

Database changes should be captured as repeatable migrations whenever possible. Avoid making a UI control or one-time manual SQL action the only record of a schema change.

## Roadmap Direction

Planned and evolving areas include:

- Deeper skills and ability progression
- Quests, encounters, and dungeon access
- Expanded inventory and reward systems
- More distinct companion personalities
- Richer memory interpretation and retrieval
- Longer-form story and world progression
- Better balancing and observability across connected systems
- Stronger automated coverage for progression and relationship state transitions

## Privacy and Intended Use

Mythic Life is currently a private, single-user personal application. It is not presented as a public production service, medical tool, or clinical health system.

## License

No open-source license is currently provided. Unless a license is added, the source code remains all rights reserved.