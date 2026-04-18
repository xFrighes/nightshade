import * as Phaser from 'phaser';
import type { GameAction, StorySceneId, StoryState } from './storyTypes';

type Interactable = {
  id: string;
  name: string;
  hint: string;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  once?: boolean;
};

type VirtualInputKey = 'left' | 'right' | 'jump';

const SCENE_TITLES: Record<StorySceneId, string> = {
  cell: 'Scene 1 - The Iron Cell',
  market: 'Scene 2 - The Under-Market',
  cathedral: 'Scene 3 - The Cathedral Ward',
  gate: 'Scene 4 - The Great Gate',
  outskirts: 'Scene 5 - The Outskirts',
};

const SCENE_PALETTES: Record<StorySceneId, { sky: number; back: number; floor: number; accent: number }> = {
  cell: { sky: 0x10131a, back: 0x232834, floor: 0x3b3b44, accent: 0xb6bcc8 },
  market: { sky: 0x180a24, back: 0x2d123f, floor: 0x35273d, accent: 0xa855f7 },
  cathedral: { sky: 0x100915, back: 0x21152b, floor: 0x33283b, accent: 0x8b5cf6 },
  gate: { sky: 0x17131a, back: 0x2d2932, floor: 0x49414a, accent: 0xf59e0b },
  outskirts: { sky: 0x101813, back: 0x1f3027, floor: 0x394536, accent: 0xcbd5e1 },
};

const SCENE_BACKGROUNDS: Record<StorySceneId, string> = {
  cell: 'bg_cell',
  market: 'bg_market',
  cathedral: 'bg_cathedral',
  gate: 'bg_gate',
  outskirts: 'bg_escape',
};

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private interactables: Interactable[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private currentState?: StoryState;
  private currentScene?: StorySceneId;
  private near?: Interactable;
  private lastInteractAt = 0;
  private virtualInput = {
    left: false,
    right: false,
    jump: false,
  };

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('mood_bg', '/bg.png');
    this.load.image('bg_cell', '/bg_cell.png');
    this.load.image('bg_market', '/bg_market.png');
    this.load.image('bg_cathedral', '/bg_cathedral.png');
    this.load.image('bg_gate', '/bg_gate.png');
    this.load.image('bg_escape', '/bg_escape.png');
    this.load.image('bg_city', '/bg_city.png');
    this.load.image('bg_underground', '/bg_underground.png');
    
    // Load ONLY the requested individual Elara sprites
    const spriteDir = '/elara_sprites/';
    this.load.image('elara_idle_1', spriteDir + 'pose_side_no_weapon_idle_1.png');
    this.load.image('elara_idle_2', spriteDir + 'pose_side_no_weapon_idle_2.png');
    this.load.image('elara_jump', spriteDir + 'pose_action_jump_1.png');
  }

  private getWorldHeight() {
    return this.scale.height + 400;
  }

  private getBaseY() {
    return this.scale.height - 320;
  }

  create() {
    const { width, height } = this.scale;
    const worldHeight = this.getWorldHeight();

    this.physics.world.setBounds(0, 0, 2200, worldHeight);
    this.cameras.main.setBounds(0, 0, 2200, worldHeight);

    // Re-create animations to ensure they override any existing ones
    this.anims.create({
      key: 'player-idle',
      frames: [{ key: 'elara_idle_1' }],
      frameRate: 1,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-walk',
      frames: [
        { key: 'elara_idle_1' },
        { key: 'elara_idle_2' }
      ],
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-jump',
      frames: [{ key: 'elara_jump' }],
      frameRate: 1,
      repeat: -1,
    });

    this.player = this.physics.add.sprite(130, this.getBaseY(), 'elara_idle_1');
    this.player.setOrigin(0.5, 1);
    this.player.setScale(0.85); 
    this.player.setCollideWorldBounds(true);
    this.player.play('player-idle');

    // Use a STABLE hitbox that doesn't change with frame size
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(80, 280);
    body.setOffset(10, 20);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setFollowOffset(0, 80);

    this.platforms = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.platforms);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.prompt = this.add.text(width / 2, height - 92, '', {
      fontFamily: 'VT323, monospace',
      fontSize: '30px',
      color: '#f5d78e',
      backgroundColor: 'rgba(5,4,8,0.72)',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5000);

    this.game.events.on('story_update', (state: StoryState) => this.applyStoryState(state));
    this.game.events.on('virtual_input', (input: { key: VirtualInputKey; active: boolean }) => {
      this.virtualInput[input.key] = input.active;
    });
    this.game.events.on('virtual_interact', () => {
      if (this.near) {
        this.emitAction(this.near.id.startsWith('collect_')
          ? { type: 'collect', target: this.near.id }
          : { type: 'interact', target: this.near.id });
      }
    });
    this.scale.on('resize', this.handleResize, this);

    this.applyStoryState((this.game.registry.get('story_state') as StoryState | undefined) ?? undefined);
  }

  update() {
    if (!this.player?.body) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    
    const speed = this.currentState?.flags.runeTaken ? 285 : 245;
    const jumpVelocity = this.currentState?.flags.runeTaken ? 610 : 470;
    const left = this.cursors.left.isDown || this.wasd.A.isDown || this.virtualInput.left;
    const right = this.cursors.right.isDown || this.wasd.D.isDown || this.virtualInput.right;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W) || this.virtualInput.jump;

    body.setVelocityX(0);

    if (left) {
      body.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (right) {
      body.setVelocityX(speed);
      this.player.setFlipX(false);
    }

    if (jumpPressed && body.blocked.down) {
      body.setVelocityY(-jumpVelocity);
      this.virtualInput.jump = false;
    }

    // Stable Animation Logic
    if (!body.blocked.down) {
      this.player.play('player-jump', true);
    } else if (left || right) {
      this.player.play('player-walk', true);
    } else {
      this.player.play('player-idle', true);
    }

    this.player.setDepth(this.player.y);
    this.updateNearestInteractable();

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && this.near && this.time.now - this.lastInteractAt > 300) {
      this.lastInteractAt = this.time.now;
      this.emitAction(this.near.id.startsWith('collect_')
        ? { type: 'collect', target: this.near.id }
        : { type: 'interact', target: this.near.id });
    }

    if (this.currentState?.scene === 'outskirts' && this.player.x > 1960) {
      this.emitAction({ type: 'scene_complete', scene: 'outskirts' });
    }
  }

  private applyStoryState(state?: StoryState) {
    if (!state) return;
    this.currentState = state;

    if (this.currentScene !== state.scene) {
      this.currentScene = state.scene;
      this.rebuildScene(state);
    } else {
      this.refreshVisibility(state);
    }
  }

  private rebuildScene(state: StoryState) {
    for (const child of [...this.children.list]) {
      if (child !== this.player) {
        child.destroy();
      }
    }
    this.platforms.clear(true, true);
    this.interactables = [];
    this.near = undefined;

    const { width, height } = this.scale;
    const worldHeight = this.getWorldHeight();
    const baseY = this.getBaseY();
    const palette = SCENE_PALETTES[state.scene];

    const worldWidth = this.physics.world.bounds.width || 2200;
    this.cameras.main.setBackgroundColor(palette.sky);
    
    const bg = this.add.image(0, 0, SCENE_BACKGROUNDS[state.scene]).setOrigin(0, 0);
    // Required size for scroll factor 0.18 to cover the screen
    const reqWidth = width + (worldWidth - width) * 0.18;
    const reqHeight = height + 400 * 0.18;
    const bgScale = Math.max(reqWidth / bg.width, reqHeight / bg.height);
    bg.setScale(bgScale);
    bg.setPosition(0, 0);
    bg.setScrollFactor(0.18);
    bg.setAlpha(state.flags.runeTaken ? 0.74 : 0.92);

    this.drawAtmosphere(state.scene, palette);
    // Transparent floor platform, raised up
    this.addPlatform(1100, baseY + 60, 2200, 120, 0x000000, 0);

    if (state.scene === 'cell') this.buildCell(baseY, palette);
    if (state.scene === 'market') this.buildMarket(baseY, palette);
    if (state.scene === 'cathedral') this.buildCathedral(baseY, palette);
    if (state.scene === 'gate') this.buildGate(baseY, palette);
    if (state.scene === 'outskirts') this.buildOutskirts(baseY, palette);

    this.player.setPosition(this.sceneStartX(state.scene), baseY);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

    this.cameras.main.setBounds(0, 0, 2200, worldHeight);

    this.prompt = this.add.text(width / 2, height - 92, '', {
      fontFamily: 'VT323, monospace',
      fontSize: '30px',
      color: '#f5d78e',
      backgroundColor: 'rgba(5,4,8,0.72)',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5000);

    this.add.text(26, 24, SCENE_TITLES[state.scene], {
      fontFamily: 'VT323, monospace',
      fontSize: '32px',
      color: '#f9d27d',
      stroke: '#050408',
      strokeThickness: 5,
    }).setScrollFactor(0).setDepth(5000);

    const controls = state.scene === 'cell'
      ? 'Move with A/D or arrows. Click glowing objects or press E to interact.'
      : 'Climb, click glowing objects, or press E when a prompt appears.';
    this.add.text(26, 62, controls, {
      fontFamily: 'VT323, monospace',
      fontSize: '24px',
      color: '#d6c7e8',
      stroke: '#050408',
      strokeThickness: 4,
    }).setScrollFactor(0).setDepth(5000);

    if (state.flags.runeTaken) {
      this.add.rectangle(0, 0, 2200, height, 0x35104d, 0.24).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.add.text(width - 34, 30, 'RUNE JUMP ACTIVE', {
        fontFamily: 'VT323, monospace',
        fontSize: '26px',
        color: '#d8b4fe',
        stroke: '#050408',
        strokeThickness: 4,
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(5000);
    }

    this.refreshVisibility(state);
  }

  private buildCell(height: number, palette: { floor: number; accent: number }) {
    this.addPlatform(515, height - 210, 260, 26, 0x4d5565);
    this.addPlatform(840, height - 330, 230, 26, 0x4d5565);
    this.drawBars(420, height - 340);
    this.addInteractable('kaelen', 'Kaelen', 'Talk to Kaelen', 520, height - 250, 56, 100, palette.accent);
    this.addInteractable('rat', 'Guard-rat', 'Distract the guard-rat with Bread', 750, height - 128, 42, 28, 0x6b4f3a);
    this.addInteractable('collect_dagger', 'Iron Dagger', 'Pick up the forgotten Iron Dagger', 930, height - 132, 42, 16, 0xc0c6d0);
    this.addInteractable('cell_exit', 'Broken Drain', 'Crawl into the Under-Market', 1300, height - 128, 92, 52, 0x1d1d25);
  }

  private buildMarket(height: number, palette: { floor: number; accent: number }) {
    this.addPlatform(520, height - 200, 260, 26, 0x4a3558);
    this.addPlatform(870, height - 315, 230, 26, 0x5b3a70);
    this.addPlatform(1210, height - 230, 250, 26, 0x4a3558);
    this.addLanterns([220, 430, 750, 1060, 1430, 1740], height, palette.accent);
    this.addInteractable('collect_coin', 'Coin Pouch', 'Jump up and collect the hidden Coin Pouch', 890, height - 360, 46, 34, 0xd6a843);
    this.addInteractable('silas', 'Silas the Broker', 'Bargain for the gate pass', 1580, height - 150, 64, 112, 0x7e22ce);
    this.addInteractable('market_exit', 'Ward Stairs', 'Enter the Cathedral Ward', 2030, height - 150, 90, 110, 0x42304d);
  }

  private buildCathedral(height: number, palette: { floor: number; accent: number }) {
    this.addPlatform(430, height - 230, 300, 28, 0x3d3348);
    this.addPlatform(810, height - 360, 260, 28, 0x4d4058);
    this.addPlatform(1190, height - 250, 270, 28, 0x3d3348);
    this.addPlatform(1540, height - 405, 330, 28, 0x4d4058);
    this.addGothicWindows([300, 620, 980, 1320, 1720], height, palette.accent);
    this.addInteractable('envoy', 'Nightshade Envoy', 'Hear the Envoy offer the Purple Rune', 1580, height - 470, 62, 106, 0x312e81);
    this.addInteractable('cathedral_exit', 'Fortified Road', 'Leave for the Great Gate', 2060, height - 150, 92, 110, 0x2c2634);
  }

  private buildGate(height: number, palette: { floor: number; accent: number }) {
    this.addPlatform(450, height - 230, 300, 28, 0x574b55);
    this.addPlatform(940, height - 300, 300, 28, 0x574b55);
    this.addPlatform(1320, height - 205, 260, 28, 0x574b55);
    this.add.rectangle(1860, height - 325, 170, 520, 0x1d1b22).setStrokeStyle(4, palette.accent, 0.45);
    this.add.rectangle(1885, height - 325, 18, 520, palette.accent, 0.3);
    this.addInteractable('kaelen_gate', 'Kaelen', 'Face Kaelen at the Great Gate', 1130, height - 160, 68, 122, 0xd6a843);
    this.addInteractable('gate_lock', 'Gate Lock', 'Open the secret side-path with the Rusted Key', 1775, height - 170, 62, 84, 0x6b5b48);
    this.addInteractable('great_gate', 'Great Gate', 'Blast or force the Great Gate', 1915, height - 210, 110, 230, 0x312e81);
  }

  private buildOutskirts(height: number, palette: { floor: number; accent: number }) {
    this.addPlatform(520, height - 225, 320, 28, 0x3f4d40);
    this.addPlatform(870, height - 310, 220, 28, 0x4c5b4f);
    this.addPlatform(1330, height - 205, 300, 28, 0x3f4d40);
    this.addFogTrees([260, 540, 900, 1240, 1630, 1960], height, palette.accent);
    this.addInteractable('envoy_final', 'Nightshade Envoy', 'Ask what the Darkness truly was', 1350, height - 160, 62, 116, 0x312e81);
    this.add.text(1770, height - 210, 'Walk into the fog', {
      fontFamily: 'VT323, monospace',
      fontSize: '28px',
      color: '#dce7df',
      stroke: '#050408',
      strokeThickness: 4,
    });
  }

  private drawAtmosphere(scene: StorySceneId, palette: { sky: number; back: number; accent: number }) {
    const { height } = this.scale;
    const worldHeight = height + 500;
    this.add.rectangle(1100, worldHeight * 0.5, 2200, worldHeight, palette.sky, 0.12);

    if (scene === 'outskirts') {
      const baseY = height - 160;
      this.add.rectangle(1100, baseY - 85, 2200, 210, 0xced7cf, 0.12);
    }

    if (scene === 'market' || scene === 'cathedral') {
      this.add.rectangle(1100, worldHeight * 0.5, 2200, worldHeight, palette.accent, 0.05).setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  private addPlatform(x: number, y: number, width: number, height: number, color: number, alpha: number = 1) {
    const platform = this.add.rectangle(x, y, width, height, color, alpha);
    if (alpha > 0) {
      platform.setStrokeStyle(2, 0x0b0810, 0.8);
    }
    this.physics.add.existing(platform, true);
    this.platforms.add(platform);
  }

  private addInteractable(
    id: string,
    name: string,
    hint: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ) {
    const rect = this.add.rectangle(x, y, width, height, color, 0.9).setStrokeStyle(3, 0xf7d27d, 0.45);
    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', () => {
      this.emitAction(id.startsWith('collect_') ? { type: 'collect', target: id } : { type: 'interact', target: id });
    });
    const label = this.add.text(x, y - height / 2 - 28, name, {
      fontFamily: 'VT323, monospace',
      fontSize: '24px',
      color: '#f8e5b3',
      stroke: '#050408',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.interactables.push({ id, name, hint, rect, label });
  }

  private refreshVisibility(state: StoryState) {
    for (const item of this.interactables) {
      const hidden =
        (item.id === 'rat' && state.flags.ratDistracted) ||
        (item.id === 'collect_dagger' && !state.flags.ratDistracted) ||
        (item.id === 'collect_dagger' && state.inventory.includes('iron_dagger')) ||
        (item.id === 'collect_coin' && state.flags.coinFound) ||
        (item.id === 'cell_exit' && !state.inventory.includes('iron_dagger') && !state.inventory.includes('rusted_key')) ||
        (item.id === 'market_exit' && !state.inventory.includes('gate_pass')) ||
        (item.id === 'cathedral_exit' && state.scene === 'cathedral' && !state.flags.runeTaken && state.flags.silasChoice === 'none');

      item.rect.setVisible(!hidden);
      item.label.setVisible(!hidden);
      if (hidden) {
        item.rect.disableInteractive();
      } else if (!item.rect.input) {
        item.rect.setInteractive({ useHandCursor: true });
      }
    }
  }

  private updateNearestInteractable() {
    let nearest: Interactable | undefined;
    let nearestDistance = 9999;

    for (const item of this.interactables) {
      if (!item.rect.visible) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, item.rect.x, item.rect.y);
      if (distance < 190 && distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }

    this.near = nearest;
    this.prompt.setText(nearest ? `E - ${nearest.hint}` : '');
  }

  private emitAction(action: GameAction) {
    this.game.events.emit('game_action', action);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const { width, height } = gameSize;
    const worldHeight = this.getWorldHeight();
    this.physics.world.setBounds(0, 0, 2200, worldHeight);
    this.cameras.main.setBounds(0, 0, 2200, worldHeight);
    this.cameras.main.setSize(width, height);
    this.rebuildScene(this.currentState!);
  }

  private sceneStartX(scene: StorySceneId) {
    if (scene === 'gate') return 180;
    if (scene === 'outskirts') return 140;
    if (scene === 'cell') return 360;
    return 130;
  }

  private drawBars(x: number, y: number) {
    this.add.rectangle(x, y, 300, 210, 0x111827, 0.35).setStrokeStyle(4, 0x9ca3af, 0.55);
    for (let i = -4; i <= 4; i += 1) {
      this.add.rectangle(x + i * 30, y, 8, 210, 0x9ca3af, 0.5);
    }
  }

  private addLanterns(xs: number[], height: number, color: number) {
    xs.forEach((x) => {
      this.add.rectangle(x, height - 360, 8, 180, 0x22162e, 0.8);
      this.add.circle(x, height - 250, 28, color, 0.5);
      this.add.circle(x, height - 250, 70, color, 0.08);
    });
  }

  private addGothicWindows(xs: number[], height: number, color: number) {
    xs.forEach((x) => {
      this.add.triangle(x, height - 390, 0, 110, 42, 0, 84, 110, color, 0.13);
      this.add.rectangle(x, height - 300, 84, 170, color, 0.1).setStrokeStyle(2, color, 0.18);
    });
  }

  private addFogTrees(xs: number[], height: number, color: number) {
    xs.forEach((x, index) => {
      this.add.rectangle(x, height - 210, 28, 220 + index * 8, 0x16241a, 0.7);
      this.add.circle(x, height - 335, 70, 0x223629, 0.55);
      this.add.circle(x + 36, height - 300, 62, color, 0.06);
    });
  }
}
