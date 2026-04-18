import type { StoryState } from '../game/storyTypes';

export interface NarrativeContext {
  npcId: string;
  npcName: string;
  playerLevel: number;
  currentQuest?: string;
  attitude?: 'humble' | 'defiant' | 'mysterious';
}

export class GeminiService {
  private static API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

  /**
   * Generates a context-aware greeting from an NPC.
   */
  static async generateGreeting(ctx: NarrativeContext): Promise<string> {
    if (!this.API_KEY) {
      return this.getFallbackGreeting(ctx);
    }

    try {
      // In a real implementation, we would call the Gemini API here.
      // For this vertical slice, we'll use a sophisticated template system 
      // that demonstrates the *prompt structure* we would use.
      
      const prompt = `
        Roleplay as ${ctx.npcName} in a dark low-fantasy medieval city.
        Context: Player is Level ${ctx.playerLevel}.
        Current Quest: ${ctx.currentQuest || "None"}.
        Attitude: ${ctx.attitude || "Neutral"}.
        Output exactly one sentence of atmospheric dialogue.
      `;

      console.log("Narrative Engine Input:", prompt);

      // Simulating a successful API call
      return this.getFallbackGreeting(ctx);
    } catch {
      return this.getFallbackGreeting(ctx);
    }
  }

  private static getFallbackGreeting(ctx: NarrativeContext): string {
    const fallbacks: Record<string, string[]> = {
      'guide': [
        "The fog is thick tonight, Initiate. Keep your blade close.",
        "Halt! You have the look of someone seeking the Shadows.",
        "Kaelen: Another day in the gutters. What do you want?"
      ],
      'merchant': [
        "Trade or talk? One costs gold, the other costs time.",
        "I have things that don't exist in the upper markets.",
        "Silas: Careful where you step. Some secrets bite."
      ]
    };

    const options = fallbacks[ctx.npcId] || ["Greeting, traveler."];
    return options[Math.floor(Math.random() * options.length)];
  }

  static judgeKaelenMood(choice: 'honor' | 'aggressive' | 'trade'): {
    mood: 'honorable' | 'hostile' | 'guarded';
    line: string;
  } {
    if (choice === 'honor') {
      return {
        mood: 'honorable',
        line: 'Kaelen studies you through the bars. "Honor. Strange word to hear down here. Take the key before I remember my orders."',
      };
    }

    if (choice === 'aggressive') {
      return {
        mood: 'hostile',
        line: 'Kaelen steps back from the bars. "Threats are the language of this prison. I am tired of speaking it."',
      };
    }

    return {
      mood: 'guarded',
      line: 'Kaelen glances at the bread, then at the hungry scrape in the wall. "Use it on the rat. I may forget my dagger close to the bars."',
    };
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
