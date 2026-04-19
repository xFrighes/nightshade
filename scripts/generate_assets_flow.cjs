const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PROMPTS = {
  "Foreground": [
    {
      name: "fg_cell",
      prompt: "transparent foreground layer for a dark low-fantasy 2.5D side-scrolling RPG dungeon cell, mossy stone floor, cracked slabs, iron bars, low ledges, broken drain opening on the right, torch-lit damp prison details, clear walkable surfaces, no characters, no text, no background wall, transparent background, game-ready PNG overlay"
    },
    {
      name: "fg_market",
      prompt: "transparent foreground layer for a dark fantasy underground market street, cobblestone walk path, stacked crates, low awnings, wooden platforms, vendor debris, purple lantern posts, climbable ledges, hidden crate area for a coin pouch, no characters, no text, no full background, transparent background, game-ready 2.5D side-scroller overlay"
    },
    {
      name: "fg_cathedral",
      prompt: "transparent foreground layer for a gothic cathedral rooftop platforming area, stone arches, crumbling ledges, broken gargoyle platforms, narrow roof walks, high balcony ledges, climbable stone platforms, dark purple moonlit atmosphere, no characters, no text, no background wall, transparent background, game-ready 2.5D side-scroller overlay"
    },
    {
      name: "fg_gate",
      prompt: "transparent foreground layer for a massive fortified bridge and city gate, stone bridge floor, heavy gate base, side-path lock area, broken battlements, torch brackets, boss arena composition, clear walkable surfaces, no characters, no text, no full background, transparent background, game-ready 2.5D side-scroller overlay"
    },
    {
      name: "fg_outskirts",
      prompt: "transparent foreground layer for a foggy forest outskirts scene overlooking a burning city, muddy path, roots, rocks, low grass, tree silhouettes in foreground, horizon path leading right, clear walkable ground, no characters, no text, no full background, transparent background, game-ready 2.5D side-scroller overlay"
    }
  ],
  "Characters": [
    {
      name: "char_elara_idle",
      prompt: "Elara, escaped prisoner heroine, full-body character sprite, dark low-fantasy 2.5D RPG, hooded leather scraps, worn prison tunic under travel cloak, cautious stance, iron dagger belt optional, three-quarter side view facing right, readable silhouette, transparent background, game-ready sprite, no text"
    },
    {
      name: "char_elara_walk",
      prompt: "Elara walking animation sprite sheet, 6 frames in one row, dark low-fantasy 2.5D RPG, hooded escaped prisoner heroine, leather scraps, worn cloak, three-quarter side view facing right, consistent proportions across frames, transparent background, game-ready sprite sheet, no text"
    },
    {
      name: "char_elara_jump",
      prompt: "Elara jumping pose, full-body character sprite, dark low-fantasy 2.5D RPG, hooded escaped prisoner heroine, cloak lifted by motion, knees tucked slightly, three-quarter side view facing right, transparent background, game-ready sprite, no text"
    },
    {
      name: "char_kaelen_guard",
      prompt: "Kaelen, tired veteran prison guard, full-body character sprite, dark low-fantasy medieval RPG, older man, worn city watch armor, spear, heavy cloak, conflicted honorable expression, three-quarter side view facing left, transparent background, readable silhouette, game-ready sprite, no text"
    },
    {
      name: "char_kaelen_gatekeeper",
      prompt: "Kaelen as gatekeeper boss, full-body character sprite, dark low-fantasy medieval RPG, veteran guard in heavier city watch armor, shield and spear, battle-ready stance, torchlit bridge mood, three-quarter side view facing left, transparent background, readable silhouette, game-ready sprite, no text"
    },
    {
      name: "char_silas",
      prompt: "Silas the Broker, full-body character sprite, dark fantasy under-market merchant, thin sly man in layered purple-black robes, rings, coin pouch, violet wax gate pass in hand, cunning posture, three-quarter side view facing left, transparent background, game-ready sprite, no text"
    },
    {
      name: "char_envoy",
      prompt: "Nightshade Envoy, hooded faction agent, full-body character sprite, dark low-fantasy RPG, black cloak with subtle purple rune glow, hidden face, gloved hand offering a purple rune, mysterious rooftop silhouette, three-quarter side view facing left, transparent background, game-ready sprite, no text"
    },
    {
      name: "char_guard_rat",
      prompt: "large dungeon guard-rat creature, small enemy/interactable sprite, dark low-fantasy RPG, mangy rat with tiny leather collar and alert eyes, side view facing left, readable at small size, transparent background, game-ready sprite, no text"
    }
  ],
  "Items": [
    {
      name: "item_bread",
      prompt: "hard prison bread loaf, dark fantasy RPG inventory icon, stale rough crust, simple readable shape, slight warm rim light, transparent background, game-ready icon, no text"
    },
    {
      name: "item_dagger",
      prompt: "iron dagger inventory icon, dark low-fantasy RPG, simple worn blade, wrapped leather grip, slight cold metal highlight, readable silhouette, transparent background, game-ready icon, no text"
    },
    {
      name: "item_key",
      prompt: "rusted old iron key inventory icon, dark fantasy RPG, corroded metal, large simple bow, readable silhouette, transparent background, game-ready icon, no text"
    },
    {
      name: "item_coin_pouch",
      prompt: "small leather coin pouch inventory icon, dark fantasy RPG, worn brown pouch tied with cord, a few gold coins visible, warm highlight, transparent background, game-ready icon, no text"
    },
    {
      name: "item_gate_pass",
      prompt: "medieval gate pass inventory icon, dark fantasy RPG, folded parchment with violet wax seal, no readable writing, worn edges, transparent background, game-ready icon, no text"
    },
    {
      name: "item_purple_rune",
      prompt: "cursed purple rune inventory icon, dark low-fantasy RPG, glowing violet stone sigil, magical aura, ominous but readable, transparent background, game-ready icon, no text"
    },
    {
      name: "prop_broken_drain",
      prompt: "broken prison drain opening, interactable environment sprite, dark dungeon stone wall/floor drain, cracked metal grate, crawl-sized exit, transparent background, game-ready 2.5D side-scroller asset, no text"
    },
    {
      name: "prop_market_crate",
      prompt: "stacked wooden market crates, interactable platforming asset, dark fantasy under-market, worn wood, rope bindings, one crate partly open, transparent background, game-ready 2.5D side-scroller asset, no text"
    },
    {
      name: "prop_gate_lock",
      prompt: "ancient heavy gate lock, interactable environment sprite, dark fantasy fortified bridge, rusted iron lock plate with keyhole, old chains, transparent background, game-ready asset, no text"
    },
    {
      name: "prop_gate_rune_target",
      prompt: "weak point on a massive fortified gate, dark fantasy RPG interactable sprite, cracked stone and iron with faint purple rune seams, designed as a blast target, transparent background, game-ready asset, no text"
    }
  ],
  "UI": [
    {
      name: "ui_dialog_frame",
      prompt: "dark low-fantasy RPG dialogue box frame, ornate but restrained gothic metal and carved dark wood, amber edge highlights, purple shadow accents, empty center transparent or dark translucent fill, no text, no icons, game-ready UI frame, transparent background"
    },
    {
      name: "ui_choice_button",
      prompt: "dark fantasy RPG dialogue choice button, horizontal button frame, carved dark metal and wood, amber border, subtle purple hover glow variant, no text, no icons, transparent background, game-ready UI asset"
    },
    {
      name: "ui_inventory_slot",
      prompt: "dark low-fantasy RPG inventory slot frame, square item slot, carved metal corners, worn leather backing, amber highlight, subtle purple shadow, no item inside, no text, transparent background, game-ready UI asset"
    },
    {
      name: "ui_quest_panel",
      prompt: "dark fantasy RPG quest log panel frame, parchment and dark carved wood, gothic metal corners, readable empty center, amber edge lighting, no text, no icons, transparent background, game-ready UI asset"
    },
    {
      name: "ui_health_frame",
      prompt: "dark low-fantasy RPG health bar frame, compact horizontal HUD frame, worn metal, red gemstone accents, amber trim, empty center for fill, no text, transparent background, game-ready UI asset"
    },
    {
      name: "ui_interact_prompt",
      prompt: "small dark fantasy RPG interact prompt frame, compact label background, ornate dark metal, amber trim, transparent background, no text, game-ready UI asset"
    }
  ],
  "VFX": [
    {
      name: "vfx_rune_glow",
      prompt: "purple magical rune glow VFX sprite sheet, 8 frames in one row, dark fantasy RPG, violet sigil pulse, transparent background, soft additive glow, game-ready effect, no text"
    },
    {
      name: "vfx_rune_blast",
      prompt: "purple rune blast VFX sprite sheet, 8 frames in one row, dark fantasy RPG magic explosion, violet energy tearing through stone, transparent background, readable effect, game-ready animation, no text"
    },
    {
      name: "vfx_dust_puff",
      prompt: "dust puff landing VFX sprite sheet, 6 frames in one row, side-scrolling RPG, gray-brown floor dust, transparent background, subtle readable animation, game-ready effect, no text"
    },
    {
      name: "vfx_lantern_glow",
      prompt: "purple lantern glow overlay, soft radial violet light, transparent background, game-ready additive VFX, no object, no text"
    },
    {
      name: "vfx_fog_wisps",
      prompt: "fog wisp VFX sprite sheet, 8 frames in one row, pale gray forest mist, transparent background, subtle flowing shape, game-ready 2.5D side-scroller effect, no text"
    },
    {
      name: "vfx_hit_spark",
      prompt: "small melee hit spark VFX sprite sheet, 5 frames in one row, dark fantasy RPG, amber-white slash impact, transparent background, game-ready effect, no text"
    }
  ],
  "Portraits": [
    {
      name: "portrait_elara",
      prompt: "portrait of Elara, escaped prisoner heroine, dark low-fantasy RPG dialogue portrait, hooded young woman, wary determined eyes, torchlit face, painterly pixel-art hybrid, transparent background or dark simple backdrop, no text"
    },
    {
      name: "portrait_kaelen",
      prompt: "portrait of Kaelen, tired veteran city guard, dark low-fantasy RPG dialogue portrait, older man, scarred face, conflicted honorable eyes, worn helmet or cloak, torchlit, painterly pixel-art hybrid, transparent background or dark simple backdrop, no text"
    },
    {
      name: "portrait_silas",
      prompt: "portrait of Silas the Broker, sly under-market dealer, dark fantasy RPG dialogue portrait, sharp face, purple-black hood, rings, calculating smile, violet lantern light, painterly pixel-art hybrid, transparent background or dark simple backdrop, no text"
    },
    {
      name: "portrait_envoy",
      prompt: "portrait of Nightshade Envoy, hooded mysterious faction agent, dark low-fantasy RPG dialogue portrait, face mostly hidden, violet rune glow under hood, ominous calm mood, painterly pixel-art hybrid, transparent background or dark simple backdrop, no text"
    }
  ]
};

const GLOBAL_STYLE = "dark low-fantasy 2.5D side-scrolling RPG asset, painterly pixel-art hybrid, gothic medieval mood, readable silhouette, game-ready, cohesive with moody dungeon/city backgrounds, no text, no watermark";

async function run() {
  console.log("Launching browser... Please log in when the window opens.");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://labs.google/fx/uk/tools/flow/project/40cdc536-734b-45df-be99-c33f06f97335');
  
  console.log("Waiting for user to log in and page to load. Make sure the prompt text area is visible...");
  // Wait for the prompt input or text area to appear
  await page.waitForSelector('textarea', { timeout: 120000 });
  console.log("Ready! Starting automation...");

  const outDir = path.join(__dirname, '..', 'public', 'story-assets');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [category, items] of Object.entries(PROMPTS)) {
    console.log(`Processing category: ${category}`);
    for (const item of items) {
      const isTransparent = item.prompt.includes("transparent background");
      
      const variants = isTransparent ? ["white #ffffff background", "black #000000 background"] : [""];
      
      for (const variant of variants) {
        const fullPrompt = `${item.prompt}, ${GLOBAL_STYLE}${variant ? ', ' + variant : ''}`;
        console.log(`Generating ${item.name} (${variant || "default"})...`);
        
        await page.locator('textarea').fill(fullPrompt);
        
        // Find and click the generate button
        await page.getByRole('button', { name: /generate|create/i }).click();
        
        // Wait for generation to complete (heuristic: wait for download button or image container to update)
        // Since we don't know the exact DOM, we can wait for the image to change, or just pause and let user click download, 
        // OR we can try to find a download button.
        console.log("Waiting for generation... (You might need to click Download manually if the script can't find it)");
        
        try {
          // Attempt to capture download automatically
          const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
          // If the site has a download button, click it. You might need to adjust this selector!
          await page.getByRole('button', { name: /download|save/i }).first().click();
          const download = await downloadPromise;
          
          const suffix = variant.includes("white") ? "_white" : (variant.includes("black") ? "_black" : "");
          const outPath = path.join(outDir, `${item.name}${suffix}.png`);
          await download.saveAs(outPath);
          console.log(`Saved ${outPath}`);
        } catch (err) {
          console.log(`Could not automatically download ${item.name}. Please manually download it now. The script will wait 15 seconds.`);
          await page.waitForTimeout(15000); // give user time to manually download and rename
        }
      }
    }
  }

  await browser.close();
  console.log("Done generating assets!");
}

run().catch(console.error);
