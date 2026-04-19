import { GoogleGenAI } from '@google/genai';
import type { StoryState } from '../game/storyTypes';

export interface NarrativeContext {
  npcId: string;
  npcName: string;
  playerLevel: number;
  currentQuest?: string;
  attitude?: 'humble' | 'defiant' | 'mysterious';
}

type KaelenPersonality = 'Cynical' | 'Honorable' | 'Cruel';
type KaelenWeakness = 'Debt' | 'Family' | 'Superstition';

const PERSONALITIES: KaelenPersonality[] = ['Cynical', 'Honorable', 'Cruel'];
const WEAKNESSES: KaelenWeakness[] = ['Debt', 'Family', 'Superstition'];

const TEXT_MODEL = 'gemini-2.5-flash';

export class GeminiService {
  private static get API_KEY(): string {
    return (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
  }

  static isConfigured(): boolean {
    return this.API_KEY.length > 0;
  }

  static readonly kaelenPersonality: KaelenPersonality =
    PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  static readonly kaelenWeakness: KaelenWeakness =
    WEAKNESSES[Math.floor(Math.random() * WEAKNESSES.length)];

  private static getAI(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: this.API_KEY });
  }

  private static kaelenSystemInstruction(): string {
    return `Roleplay as Kaelen, a weary guard in the Iron Cell.
Context: Elara is trying to escape.
Personality: ${this.kaelenPersonality}.
Secret Weakness: ${this.kaelenWeakness}.

Rules:
1. Keep responses under 2 sentences. Gritty, low-fantasy tone. No emojis.
2. If Elara exploits your weakness (mentions ${this.kaelenWeakness.toLowerCase()}, or alludes to it meaningfully), shift to merciful and end your response with [ESCAPE_SUCCESS].
3. If mood is already merciful, always end your response with [ESCAPE_SUCCESS].
4. Use prior dialogue for continuity. Never break character.`;
  }

  /**
   * Generates a Kaelen response using multi-turn generateContent with full dialogue history.
   */
  static async generateKaelenResponse(
    playerMessage: string,
    dialogueHistory: string[]
  ): Promise<{ line: string; escaped: boolean }> {
    if (!this.API_KEY) {
      throw new Error('Gemini is not configured. Set VITE_GEMINI_API_KEY in .env and restart the dev server.');
    }

    try {
      const ai = this.getAI();

      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      dialogueHistory.forEach((entry, i) => {
        contents.push({ role: i % 2 === 0 ? 'user' : 'model', parts: [{ text: entry }] });
      });
      contents.push({ role: 'user', parts: [{ text: playerMessage }] });

      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        config: { systemInstruction: this.kaelenSystemInstruction() },
        contents,
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }
      const escaped = text.includes('[ESCAPE_SUCCESS]');
      return { line: text.replace('[ESCAPE_SUCCESS]', '').trim(), escaped };
    } catch (err) {
      console.error('Gemini Kaelen error:', err);
      throw err instanceof Error
        ? err
        : new Error('Gemini failed to generate Kaelen response.');
    }
  }

  static async generateKaelenGreeting(
    scene: 'cell' | 'gate',
    state: StoryState
  ): Promise<string> {
    if (!this.API_KEY) {
      throw new Error('Gemini is not configured. Set VITE_GEMINI_API_KEY in .env and restart the dev server.');
    }

    const sceneContext = scene === 'cell'
      ? 'Elara is still locked behind the Iron Cell bars and has just approached Kaelen.'
      : 'Elara has reached the Great Gate. Kaelen blocks the bridge, but his conscience is strained.';

    try {
      const ai = this.getAI();
      const response = await ai.models.generateContent({
        model: TEXT_MODEL,
        config: {
          systemInstruction: `${this.kaelenSystemInstruction()}

Opening-line rules:
1. Write only Kaelen's next spoken line plus sparse body language.
2. Do not include [ESCAPE_SUCCESS] in this opener.
3. Keep it under 2 sentences.
4. Reflect current mood: ${state.flags.kaelenMood}.`,
        },
        contents: `${sceneContext}
Recent dialogue: ${state.dialogueHistory.slice(-6).join(' | ') || 'None yet.'}`,
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error('Gemini returned an empty greeting.');
      }
      return text.replace('[ESCAPE_SUCCESS]', '').trim();
    } catch (err) {
      console.error('Gemini Kaelen greeting error:', err);
      throw err instanceof Error
        ? err
        : new Error('Gemini failed to generate Kaelen greeting.');
    }
  }

  /**
   * One-shot rat hint via standard text generation (Live not needed for single-turn).
   */
  static async generateRatHint(): Promise<string> {
    const fallback = `*Squeak*... the iron man carries a wound older than his orders — find the crack in his ${this.kaelenWeakness.toLowerCase()}.`;

    if (!this.API_KEY) return fallback;

    try {
      const ai = this.getAI();
      const result = await ai.models.generateContent({
        model: TEXT_MODEL,
        config: {
          systemInstruction: `You are the Iron Cell Rat. You have been paid in coin.
The guard Kaelen's secret weakness is: ${this.kaelenWeakness}.
Give exactly 1 sentence — cryptic, squeaky (use *Squeak* sounds), never name the weakness directly.
Example: "*Squeak*... he fears what he cannot see in the shadows."`,
        },
        contents: 'Give me your hint about the guard.',
      });
      return result.text?.trim() ?? fallback;
    } catch (err) {
      console.error('Gemini rat hint error:', err);
      return fallback;
    }
  }

  static judgeSilasBargain(state: StoryState, approach: 'pay' | 'threaten'): {
    accepted: boolean;
    line: string;
    choice: 'paid' | 'threatened' | 'owed_favor';
  } {
    const hasCoin = state.inventory.includes('coin_pouch') || state.gold >= 6;
    const hasDagger = state.inventory.includes('iron_dagger');

    if (approach === 'pay' && hasCoin) {
      return {
        accepted: true,
        choice: 'paid',
        line: 'Silas weighs the pouch and smiles without warmth. "Clean coin from dirty streets. A gate pass for a woman who knows how to climb."',
      };
    }
    if (approach === 'threaten' && hasDagger) {
      return {
        accepted: true,
        choice: 'threatened',
        line: 'The dagger point stills Silas mid-laugh. "Fine. Take the pass. But threats cast long shadows, Elara."',
      };
    }
    return {
      accepted: false,
      choice: 'owed_favor',
      line: 'Silas taps the pass against his teeth. "No coin, no convincing steel. Take it, then owe me a theft when the city stops burning."',
    };
  }

  static envoyLine(state: StoryState): string {
    if (state.flags.silasChoice === 'threatened') {
      return 'The Envoy bows from the ledge. "Silas bleeds fear now. Nightshade respects efficient cruelty."';
    }
    if (state.flags.silasChoice === 'paid') {
      return 'The Envoy watches the violet wax on your pass. "You fed the broker instead of cutting the rot. That mercy has a price."';
    }
    return 'The Envoy lowers a gloved hand. "A debt to Silas is a hook in your soul. Take our Rune and jump beyond him."';
  }

  static legacySummary(state: StoryState): string {
    const fragments: string[] = [];

    if (state.flags.kaelenMood === 'honorable' || state.flags.gateOutcome === 'persuaded') {
      fragments.push('Elara kept a guard from becoming only his orders');
    } else if (state.flags.kaelenMood === 'hostile' || state.flags.gateOutcome === 'fought') {
      fragments.push('Elara taught the City Watch to remember her as a blade in the dark');
    } else {
      fragments.push('Elara slipped through the city by reading tired men and locked doors');
    }

    if (state.flags.silasChoice === 'paid') {
      fragments.push('she bought freedom when blood would have been cheaper');
    } else if (state.flags.silasChoice === 'threatened') {
      fragments.push('she bent Silas with iron and left a debt of fear behind her');
    } else {
      fragments.push("she accepted Silas's favor and carried a future chain into the fog");
    }

    if (state.flags.runeTaken) {
      fragments.push('and the Purple Rune marked her escape with power that will ask for repayment');
    } else {
      fragments.push('and she refused the Rune, escaping with fewer answers but cleaner hands');
    }

    const title = state.flags.runeTaken
      ? state.flags.gateOutcome === 'fought'
        ? 'The Cursed Breaker'
        : 'The Violet Fugitive'
      : state.flags.gateOutcome === 'secret'
        ? 'The Keeper of Hidden Roads'
        : 'The Unmarked Flame';

    return `${title}: ${fragments.join(', ')}. The Darkness was never only magic. It was every bargain that made good people look away.`;
  }
}
