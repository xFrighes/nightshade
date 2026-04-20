# Architecture Notes

Nightshade uses a small hybrid architecture: Phaser handles the real-time scene, while React handles interface state, overlays, persistence, and external service calls.

## Runtime Boundaries

- `src/game/GameScene.ts` owns rendering, physics, interaction zones, scene transitions, and input polling.
- `src/App.tsx` owns story decisions, modal state, combat state, asset loading, wallet flow, and top-level UI orchestration.
- `src/store/gameStore.ts` persists settings, player state, quests, and world feed entries to local storage.
- `src/game/storyTypes.ts` keeps story scenes, flags, item definitions, and scene metadata centralized.

## React and Phaser Bridge

Phaser emits browser events for gameplay changes such as movement, scene changes, and interaction prompts. React listens for those events and updates the overlays. React also sends story updates back to Phaser through the store so the scene can reflect unlocked doors, hidden characters, and completed interactions.

## Persistence

The current build is client-only. Save data lives in local storage and is intentionally scoped to:

- player stats
- inventory
- story flags
- quest progress
- user settings

The state shape is narrow enough to replace local storage with a backend later without rewriting the game scene.

## External Services

Gemini is optional and only styles dialogue. It does not decide game outcomes. Every Gemini call has an authored fallback so the game remains playable offline or without an API key.

The Solana wallet flow is optional and limited to the devnet rat bribe interaction. The game checks wallet availability, requests a connection, and falls back to normal story handling if the wallet flow is unavailable.

## Asset Loading

`src/game/assetManifest.ts` lists browser-preloaded assets separately from Phaser-loaded scene assets. This keeps the start screen responsive while still warming the cache for the full play session.
