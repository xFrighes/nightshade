# Nightshade

Nightshade is a dark low-fantasy RPG slice set in a medieval city of prison cells, markets, gates, and uneasy bargains. The game pairs Phaser for the real-time world with React for interface layers, dialogue, inventory, settings, and save-state presentation.

## Stack

- React 19 and TypeScript
- Phaser for scene rendering, movement, collisions, and interaction zones
- Tailwind CSS v4 plus custom CSS for the game shell
- Local storage for save data and player settings
- Optional Gemini integration for styled NPC responses, with authored fallbacks when the API is unavailable
- Optional Solana devnet wallet interaction for the rat bribe encounter

## Features

- Belt-scroll exploration with scene transitions and depth-sorted characters
- Keyboard movement with configurable controls, stamina, and interaction prompts
- Branching authored story state across prison, market, cathedral, gate, and outskirts scenes
- Inventory, quest log, world feed, settings, reset flow, and story log overlays
- Audio, cursor, and image preloading for a smoother first play session

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file if you want AI-assisted dialogue:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Controls

- Arrow keys or WASD: Move Elara
- Shift: Sprint while stamina is available
- E: Interact
- I: Toggle inventory
- Mouse: Use UI controls and dialogue choices

## Architecture

Phaser owns the real-time game loop and emits gameplay events such as scene changes, player movement, and interactable selection. React owns application state, persistence, overlays, and service calls. Shared state flows through `src/store/gameStore.ts`, with story progression modeled in `src/game/storyTypes.ts`.
