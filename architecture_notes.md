# Architecture Notes: Dark Low-Fantasy RPG Vertical Slice

## Game Architecture Overview
The game follows a **Hybrid State Model** where a centralized source of truth (the React State) drives the UI and persists the player data, while a high-performance engine (Phaser 3) manages real-time physics, rendering, and gameplay interactions.

### 1. Game Loop (Phaser 3)
- **Scene Management**: A single `GameScene` handles the belt-scroll environment. 
- **Entity System**: The `Player` and `NPC` classes are Phaser Sprites with added logic for movement, collision detection, and interaction range.
- **2.5D Logic**: Ground plane navigation using a fixed walk area (`y` bounds) to simulate depth while keeping the movement 2D (left/right).

### 2. Persistence Model
- **Local Storage**: Player stats, inventory, quest progress, and reputation are serialized and saved to `localStorage` on every meaningful state change.
- **MMO Simulation**: A deterministic mock "World Feed" generates entries based on the current system time to simulate activity from other players.

### 3. AI Integration (Gemini API)
- **Layering**: AI is used to *decorate* dialogue. It does not decide game outcomes.
- **Flow**: User interacts -> System sends context (NPC role, current quest, player attitude) -> Gemini returns a styled greeting or response -> Text is displayed in the React `DialogBox`.
- **Safety**: Fallbacks are built-in for every call; if the API fails, a pre-written static response is used instantly.

### 4. React-Phaser Bridge
- **Emitter System**: Phaser emits events (e.g., `NPC_INTERACT`, `PLAYER_MOVE`) that React listens to.
- **Sync**: React state updates are reflected in the HUD, while Phaser state updates are triggered by user input.

### 5. MMO-like Features (Hackathon Scope)
- **Presence**: Simulated by random "adventurer" chat messages and reputation titles.
- **Scaling**: The state structure is designed to be easily extensible to a real backend if needed.
- **UI Design**: A heavy, immersive MMO-style interface with inventory slots, quest logs, and a world chat log.
