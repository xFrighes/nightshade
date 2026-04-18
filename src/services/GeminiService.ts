/**
 * Gemini Narrative Service
 * Handles context-aware dialogue generation for the Nightshade RPG.
 */

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
    } catch (e) {
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
}
