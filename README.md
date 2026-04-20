# Nightshade: Dark Low-Fantasy RPG Prototype

A polished vertical slice of a dark medieval city RPG, built with an MMO-like structure and moody pixel-art aesthetics.

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Game Engine**: Phaser 3.80+ (Arcade Physics)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Narrative**: Integrated Gemini API (with robust local fallbacks)

## Core Features
- **Atmospheric 2.5D World**: A belt-scroll environment with depth-sorting and lantern-lit mood.
- **MMO-like Systems**: 
  - Persistent save data (Local Storage).
  - XP/Leveling and Inventory management.
  - Interactive NPC dialogue trees.
  - Live "World Feed" simulating other players' activity.
- **Gemini AI Integration**: Dynamic narrative engine that styles NPC greetings based on player context (Level, Quest, Attitude).

## How to Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up Gemini API (Optional):
   Create a `.env` file and add:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## Controls
- **Arrow Keys**: Move character (Left/Right/Up/Down)
- **I Key**: Toggle Inventory
- **Mouse**: Interact with UI and NPCs (when near)

## Architecture Note
The project uses a **Hybrid State Model**. Phaser handles the real-time simulation, while React manages the complex UI overlays. Both sync via a centralized `GameStore` that persists state to `localStorage`.

---
*Created for the AI Hackfest hosted by Major League Hacking.*
