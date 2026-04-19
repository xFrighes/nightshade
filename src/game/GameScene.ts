import * as Phaser from 'phaser';
import type { GameAction, StorySceneId, StoryState } from './storyTypes';
import { DEFAULT_KEY_BINDINGS, type SettingsState } from '../store/gameStore';

type Interactable = {
  id: string;
  name: string;
  hint: string;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type VirtualInputKey = 'left' | 'right' | 'jump';
type ControlAction = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'interact' | 'inventory';

const CELL_BARS_RIGHT_EDGE = 720;
const CELL_SPAWN_X = 200;

const SCENE_TITLES: Record<StorySceneId, string> = {
  cell: '', // 'Scene 1 — The Iron Cell',
  market: 'Scene 2 — The Under-Market',
  cathedral: 'Scene 3 — The Cathedral Ward',
  gate: 'Scene 4 — The Great Gate',
  outskirts: 'Scene 5 — The Outskirts',
};

const SCENE_PALETTES: Record<StorySceneId, { sky: number; back: number; floor: number; accent: number }> = {
  cell: { sky: 0x07090f, back: 0x141820, floor: 0x252530, accent: 0x8aaac8 },
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
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private hideUIKey!: Phaser.Input.Keyboard.Key;
  private actionKeys!: Record<ControlAction, Phaser.Input.Keyboard.Key>;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private interactables: Interactable[] = [];
  private currentState?: StoryState;
  private currentScene?: StorySceneId;
  private near?: Interactable;
  private lastInteractAt = 0;
  private introShown = false;
  private virtualInput = { left: false, right: false, jump: false };
  private viewScale = 1;
  private sceneTitleText?: Phaser.GameObjects.Text;
  private uiVisible = true;
  private bgImage?: Phaser.GameObjects.Image;
  private stamina = 10;
  private maxStamina = 10;
  private staminaRegenTimer = 0;
  private footstepTimer = 0;
  private settings?: SettingsState;

  constructor() { super('GameScene'); }

  private v(n: number) { return n * this.viewScale; }

  preload() {
    this.load.on('progress', (value: number) => {
      this.game.events.emit('asset_load_progress', value);
    });
    this.load.on('loaderror', (file: { src?: string; url?: string; key?: string }) => {
      this.game.events.emit('asset_load_error', file.src ?? file.url ?? file.key ?? 'unknown asset');
    });
    this.load.once('complete', () => {
      this.game.events.emit('asset_load_progress', 1);
      this.game.events.emit('asset_load_complete');
    });

    this.load.image('bg_cell', '/bg_cell.webp');
    this.load.image('bg_cell_open', '/bg_cell_open.webp');
    this.load.image('bg_market', '/bg_market.webp');
    this.load.image('bg_cathedral', '/bg_cathedral.webp');
    this.load.image('bg_gate', '/bg_gate.webp');
    this.load.image('bg_escape', '/bg_escape.webp');
    this.load.image('bg_city', '/bg_city.webp');
    this.load.image('bg_underground', '/bg_underground.webp');
    this.load.image('rat', '/rat.webp');
    this.load.spritesheet('guide', '/guide.webp', { frameWidth: 170, frameHeight: 279 });
    this.load.spritesheet('player-idle', '/elara-idle.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('player-walk', '/elara-walk.png', { frameWidth: 256, frameHeight: 256 });

    this.load.audio('sfx_jump', '/sounds/jump.wav');
    this.load.audio('sfx_collect', '/sounds/collect.wav');
    this.load.audio('sfx_interact', '/sounds/interact.wav');
    this.load.audio('sfx_footstep', '/sounds/footstep.wav');
    this.load.audio('sfx_click', '/sounds/click.wav');
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  private getWorldHeight() { return this.scale.height + 400; }
  private getBaseY() { return this.scale.height - this.v(72); }
  private getPlayerScale(h = 256) { return (this.v(262) / h) * 2.8; }

  create() {
    const { height } = this.scale;
    const worldHeight = this.getWorldHeight();

    this.physics.world.setBounds(0, 0, 2200, worldHeight);
    this.cameras.main.setBounds(0, 0, 2200, height);

    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: this.anims.generateFrameNumbers('player-idle', { start: 0, end: 24 }),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists('player-walk')) {
      this.anims.create({
        key: 'player-walk',
        frames: this.anims.generateFrameNumbers('player-walk', { start: 0, end: 24 }),
        frameRate: 15,
        repeat: -1,
      });
    }

    if (!this.anims.exists('guide-idle')) {
      this.anims.create({
        key: 'guide-idle',
        frames: [
          ...this.anims.generateFrameNumbers('guide', { start: 0, end: 2 }),
          ...this.anims.generateFrameNumbers('guide', { start: 1, end: 1 })
        ],
        frameRate: 5,
        repeat: -1,
      });
    }

    this.player = this.physics.add.sprite(130, this.getBaseY(), 'player-idle');
    this.player.setOrigin(0.5, 1);
    this.player.setScale(this.getPlayerScale());
    this.player.setCollideWorldBounds(true);
    this.player.play('player-idle');
    this.syncPlayerBodyToFrame();

    this.cameras.main.startFollow(this.player, true, 0.08, 0);
    this.cameras.main.setFollowOffset(0, 0);

    this.platforms = this.physics.add.staticGroup();
    this.physics.add.collider(this.player, this.platforms);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.hideUIKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.settings = this.game.registry.get('settings') as SettingsState | undefined;
    this.rebuildActionKeys();

    this.game.events.on('story_update', (state: StoryState) => this.applyStoryState(state));
    this.game.events.on('ui_visibility', (visible: boolean) => {
      this.uiVisible = visible;
      this.sceneTitleText?.setAlpha(visible ? 1 : 0);
    });
    this.game.events.on('virtual_input', (input: { key: VirtualInputKey; active: boolean }) => {
      this.virtualInput[input.key] = input.active;
    });
    this.game.events.on('settings_update', (settings: SettingsState) => {
      this.settings = settings;
      this.rebuildActionKeys();
    });
    this.game.events.on('virtual_interact', () => {
      if (this.near) this.emitAction(this.near.id.startsWith('collect_')
        ? { type: 'collect', target: this.near.id }
        : { type: 'interact', target: this.near.id });
    });
    this.scale.on('resize', this.handleResize, this);
    this.applyStoryState((this.game.registry.get('story_state') as StoryState | undefined) ?? undefined);
  }

  update(_time: number, delta: number) {
    if (!this.player?.body) return;

    // Stamina regeneration
    if (this.stamina < this.maxStamina) {
      this.staminaRegenTimer += delta;
      if (this.staminaRegenTimer >= 150) { // regenerate every 150ms
        this.stamina = Math.min(this.maxStamina, this.stamina + 0.5);
        this.staminaRegenTimer = 0;
        this.game.events.emit('stamina_update', this.stamina / this.maxStamina);
      }
    }

    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = this.v(this.currentState?.flags.runeTaken ? 285 : 245);
    const jump = this.v(this.currentState?.flags.runeTaken ? 610 : 470);
    const verticalKey = this.settings?.controls.invertY ? this.actionKeys.moveDown : this.actionKeys.moveUp;
    const verticalCursor = this.settings?.controls.invertY ? this.cursors.down : this.cursors.up;
    const left = this.cursors.left.isDown || this.actionKeys.moveLeft.isDown || this.virtualInput.left;
    const right = this.cursors.right.isDown || this.actionKeys.moveRight.isDown || this.virtualInput.right;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(verticalCursor)
      || Phaser.Input.Keyboard.JustDown(verticalKey)
      || Phaser.Input.Keyboard.JustDown(this.spaceKey)
      || this.virtualInput.jump;

    body.setVelocityX(0);
    if (left) { body.setVelocityX(-speed); this.player.setFlipX(true); }
    if (right) { body.setVelocityX(speed); this.player.setFlipX(false); }

    if ((left || right) && body.blocked.down) {
      this.footstepTimer += delta;
      if (this.footstepTimer >= 320) {
        this.sound.play('sfx_footstep', { volume: 0.15 * (this.settings?.audio.masterVolume ?? 1) });
        this.footstepTimer = 0;
      }
    } else {
      this.footstepTimer = 300; // Ready for first step when starting to walk
    }

    if (jumpPressed && body.blocked.down && this.stamina >= 2) {
      body.setVelocityY(-jump);
      this.sound.play('sfx_jump', { volume: 0.4 * (this.settings?.audio.masterVolume ?? 1) });
      this.virtualInput.jump = false;
      this.stamina -= 2;
      this.game.events.emit('stamina_update', this.stamina / this.maxStamina);
      this.shakeCamera(90, 0.0025);
    }

    if (this.currentState?.scene === 'cell') {
      if (this.player.x > this.v(CELL_BARS_RIGHT_EDGE)) {
        this.player.x = this.v(CELL_BARS_RIGHT_EDGE);
        body.setVelocityX(0);
      }
      if (this.player.x < this.v(CELL_SPAWN_X)) {
        this.player.x = this.v(CELL_SPAWN_X);
        body.setVelocityX(0);
      }
    }

    const nextAnim = left || right ? 'player-walk' : 'player-idle';
    if (this.player.anims.currentAnim?.key !== nextAnim) {
      this.player.play(nextAnim, true);
    }

    this.syncPlayerBodyToFrame();
    this.player.setDepth(this.player.y);
    this.updateNearestInteractable();

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.interact) && this.near && this.time.now - this.lastInteractAt > 300) {
      this.lastInteractAt = this.time.now;
      this.emitAction(this.near.id.startsWith('collect_')
        ? { type: 'collect', target: this.near.id }
        : { type: 'interact', target: this.near.id });
    }

    if (Phaser.Input.Keyboard.JustDown(this.hideUIKey)) {
      this.sound.play('sfx_click', { volume: 0.3 * (this.settings?.audio.masterVolume ?? 1) });
      this.game.events.emit('toggle_ui');
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.inventory)) {
      this.sound.play('sfx_click', { volume: 0.3 * (this.settings?.audio.masterVolume ?? 1) });
      this.game.events.emit('toggle_inventory');
    }

    if (this.currentState?.scene === 'outskirts' && this.player.x > this.physics.world.bounds.width - 240) {
      this.emitAction({ type: 'scene_complete', scene: 'outskirts' });
    }
  }

  // ── Story wiring ─────────────────────────────────────────────────────────────

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
      if (child !== this.player) child.destroy();
    }
    this.platforms.clear(true, true);
    this.interactables = [];
    this.near = undefined;

    const { width, height } = this.scale;
    this.viewScale = height / 1080; // Reference height where placements were correct
       const worldHeight = this.getWorldHeight();
    const baseY = this.getBaseY();
    const palette = SCENE_PALETTES[state.scene];

    this.cameras.main.setBackgroundColor(palette.sky);
    const bgKey = state.scene === 'cell' && state.inventory.includes('rusted_key')
      ? 'bg_cell_open'
      : SCENE_BACKGROUNDS[state.scene];
    const bg = this.add.image(0, height / 2, bgKey)
      .setAlpha(state.flags.runeTaken ? 0.74 : 0.92)
      .setDepth(0);
    this.bgImage = bg;

    const bgScale = height / bg.height;
    bg.setScale(bgScale);

    const worldWidth = bg.displayWidth;
    bg.setX(worldWidth / 2);
    bg.setScrollFactor(1, 0);

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, height);

    this.drawAtmosphere(state.scene, palette, worldWidth);
    this.addPlatform(worldWidth / 2, baseY + this.v(60), worldWidth, this.v(120), 0x000000, 0);

    if (state.scene === 'cell') this.buildCell(baseY, palette);
    if (state.scene === 'market') this.buildMarket(baseY);
    if (state.scene === 'cathedral') this.buildCathedral(baseY);
    if (state.scene === 'gate') this.buildGate(baseY, palette);
    if (state.scene === 'outskirts') this.buildOutskirts(baseY);

    this.player.setScale(this.getPlayerScale());
    this.player.setPosition(this.v(this.sceneStartX(state.scene)), baseY);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.player.play('player-idle');
    this.syncPlayerBodyToFrame();

    this.sceneTitleText = this.add.text(this.v(26), this.v(24), SCENE_TITLES[state.scene], {
      fontFamily: 'VT323, monospace',
      fontSize: `${Math.round(this.v(32))}px`,
      color: '#f9d27d',
      stroke: '#050408',
      strokeThickness: this.v(5),
    }).setScrollFactor(0).setDepth(5000);
    this.sceneTitleText.setAlpha(this.uiVisible ? 1 : 0);

    if (state.flags.runeTaken) {
      this.add.rectangle(0, 0, 2200, height, 0x35104d, 0.24)
        .setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
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

  // ── Cell scene ───────────────────────────────────────────────────────────────

  private buildCell(bY: number, palette: { floor: number; accent: number }) {
    this.drawGuardVisual(this.v(1080), bY);
    // Interaction zone at bars edge; label rendered over the sprite on the other side
    this.addInteractable('guard', 'Guard', 'Speak with the Guard through the bars',
      this.v(700), bY - this.v(60), this.v(50), this.v(700), palette.accent, 0.0, this.v(1100), bY - this.v(540));
    this.addInteractable('cell_exit', 'Bars', 'Slip through the unlocked bars',
      this.v(700), bY - this.v(60), this.v(50), this.v(700), 0x4a6080, 0.0, this.v(700));

    this.drawRat(this.v(435), bY - this.v(195));
    this.addInteractable('rat', 'Guard-rat', 'Bribe the rat',
      this.v(435), bY - this.v(60), this.v(140), this.v(90), 0x7a5030, 0.0, undefined, bY - this.v(310));

    if (!this.introShown) {
      this.introShown = true;
      this.showCellIntro();
    }
  }

  // ── Cell visual helpers ──────────────────────────────────────────────────────

  private drawGuardVisual(x: number, y: number) {
    const guard = this.add.sprite(x, y, 'guide')
      .setOrigin(0.5, 1)
      .setDepth(22)
      .setScale(this.getPlayerScale(279) * 0.85)
      .setName('kaelen_visual');

    if (this.anims.exists('guide-idle')) {
      guard.play('guide-idle');
    }
    return guard;
  }

  private drawRat(x: number, y: number) {
    const rat = this.add.image(x, y, 'rat')
      .setOrigin(0.5, 1)
      .setDepth(100)
      .setName('rat_visual')
      .setFlipX(true)
      .setDisplaySize(this.v(180), this.v(102));

    this.tweens.add({
      targets: rat,
      scaleX: '*=1.04',
      scaleY: '*=0.96',
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /*
  private addInteractableGlow(x: number, y: number, w: number, h: number) {
    const ring = this.add.rectangle(x, y, w + 14, h + 14, 0x8aaac8, 0)
      .setStrokeStyle(2, 0x8aaac8, 0.6)
      .setDepth(21);
    this.tweens.add({
      targets: ring,
      alpha: { from: 0, to: 0.4 },
      duration: 850, ease: 'Sine.easeInOut',
      yoyo: true, repeat: 7,
      onComplete: () => ring.destroy(),
    });
  }
  */

  private showCellIntro() {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width * 3, height * 3, 0x000000, 0)
      .setScrollFactor(0).setDepth(9998);
    const text = this.add.text(width / 2, height / 2,
      '' /* 'Year 3 of the Darkness.\n\nThe Iron Cell  —  City of Ashenmoor.\n\nElara wakes.' */, {
      fontFamily: 'VT323, monospace',
      fontSize: `${Math.round(this.v(44))}px`,
      color: '#e8d0a0',
      align: 'center',
      lineSpacing: this.v(14),
      stroke: '#000000',
      strokeThickness: this.v(4),
    }).setOrigin(0.5).setScrollFactor(0).setDepth(9999).setAlpha(0);

    this.tweens.chain({
      tweens: [
        { targets: overlay, alpha: 1, duration: 300 },
        { targets: text, alpha: 1, duration: 500, delay: 100 },
        { targets: text, alpha: 1, duration: 2400 },
        { targets: text, alpha: 0, duration: 500 },
        {
          targets: overlay, alpha: 0, duration: 700,
          onComplete: () => { overlay.destroy(); text.destroy(); }
        },
      ],
    });
  }

  // ── Other scenes ─────────────────────────────────────────────────────────────

  private buildMarket(height: number) {
    this.addPlatform(this.v(520), height - this.v(200), this.v(260), this.v(26), 0x4a3558);
    this.addPlatform(this.v(870), height - this.v(315), this.v(230), this.v(26), 0x5b3a70);
    this.addPlatform(this.v(1210), height - this.v(230), this.v(250), this.v(26), 0x4a3558);
    this.addInteractable('collect_coin', 'Coin Pouch',
      'Jump up and collect the hidden Coin Pouch', this.v(890), height - this.v(360), this.v(46), this.v(34), 0xd6a843);
    this.addInteractable('silas', 'Silas the Broker',
      'Bargain for the gate pass', this.v(1580), height - this.v(150), this.v(64), this.v(112), 0x7e22ce);
    this.addInteractable('market_exit', 'Ward Stairs',
      'Enter the Cathedral Ward', this.v(2030), height - this.v(150), this.v(90), this.v(110), 0x42304d);
  }

  private buildCathedral(height: number) {
    this.addPlatform(this.v(430), height - this.v(230), this.v(300), this.v(28), 0x3d3348);
    this.addPlatform(this.v(810), height - this.v(360), this.v(260), this.v(28), 0x4d4058);
    this.addPlatform(this.v(1190), height - this.v(250), this.v(270), this.v(28), 0x3d3348);
    this.addPlatform(this.v(1540), height - this.v(405), this.v(330), this.v(28), 0x4d4058);
    this.addInteractable('envoy', 'Nightshade Envoy',
      'Hear the Envoy offer the Purple Rune', this.v(1580), height - this.v(470), this.v(62), this.v(106), 0x312e81);
    this.addInteractable('cathedral_exit', 'Fortified Road',
      'Leave for the Great Gate', this.v(2060), height - this.v(150), this.v(92), this.v(110), 0x2c2634);
  }

  private buildGate(height: number, palette: { floor: number; accent: number }) {
    this.addPlatform(this.v(450), height - this.v(230), this.v(300), this.v(28), 0x574b55);
    this.addPlatform(this.v(940), height - this.v(300), this.v(300), this.v(28), 0x574b55);
    this.addPlatform(this.v(1320), height - this.v(205), this.v(260), this.v(28), 0x574b55);
    this.add.rectangle(this.v(1860), height - this.v(325), this.v(170), this.v(520), 0x1d1b22)
      .setStrokeStyle(this.v(4), palette.accent, 0.45);
    this.add.rectangle(this.v(1885), height - this.v(325), this.v(18), this.v(520), palette.accent, 0.3);

    this.drawGuardVisual(this.v(1690), height);
    this.addInteractable('guard_gate', 'Guard',
      'Face the Guard at the Great Gate', this.v(1690), height - this.v(209), this.v(160), this.v(419), 0xd6a843, 0.0, this.v(1710), height - this.v(540));
    this.addInteractable('gate_lock', 'Gate Lock',
      'Open the secret side-path with the Rusted Key', this.v(1775), height - this.v(170), this.v(62), this.v(84), 0x6b5b48);
    this.addInteractable('great_gate', 'Great Gate',
      'Blast or force the Great Gate', this.v(1915), height - this.v(210), this.v(110), this.v(230), 0x312e81);
  }

  private buildOutskirts(height: number) {
    this.addPlatform(this.v(520), height - this.v(225), this.v(320), this.v(28), 0x3f4d40);
    this.addPlatform(this.v(870), height - this.v(310), this.v(220), this.v(28), 0x4c5b4f);
    this.addPlatform(this.v(1330), height - this.v(205), this.v(300), this.v(28), 0x3f4d40);
    this.addInteractable('envoy_final', 'Nightshade Envoy',
      'Ask what the Darkness truly was', this.v(1350), height - this.v(160), this.v(62), this.v(116), 0x312e81);
    this.add.text(this.v(1770), height - this.v(210), 'Walk into the fog', {
      fontFamily: 'VT323, monospace',
      fontSize: `${Math.round(this.v(28))}px`,
      color: '#dce7df',
      stroke: '#050408',
      strokeThickness: this.v(4),
    });
  }

  // ── Shared helpers ───────────────────────────────────────────────────────────

  private drawAtmosphere(scene: StorySceneId, palette: { sky: number; back: number; accent: number }, bgWidth: number) {
    const { height } = this.scale;
    const ax = bgWidth / 2;
    this.add.rectangle(ax, height / 2, bgWidth, height, palette.sky, 0.12)
      .setScrollFactor(1, 0);
    if (scene === 'outskirts') {
      this.add.rectangle(ax, height - this.v(160) - this.v(85), bgWidth, this.v(210), 0xced7cf, 0.12)
        .setScrollFactor(1, 0);
    }
    if (scene === 'market' || scene === 'cathedral') {
      this.add.rectangle(ax, height / 2, bgWidth, height, palette.accent, 0.05)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(1, 0);
    }
  }

  private addPlatform(x: number, y: number, w: number, h: number, color: number, alpha = 1) {
    const plat = this.add.rectangle(x, y, w, h, color, alpha);
    if (alpha > 0) plat.setStrokeStyle(this.v(2), 0x0b0810, 0.8);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);
  }

  private syncPlayerBodyToFrame() {
    if (!this.player?.body || !this.player.frame) return;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const bodyWidth = this.v(160);
    const bodyHeight = this.v(360);
    const frameWidth = this.player.frame.realWidth;
    const frameHeight = this.player.frame.realHeight;

    body.setSize(bodyWidth / this.player.scaleX, bodyHeight / this.player.scaleY);
    body.setOffset(
      (frameWidth - (bodyWidth / this.player.scaleX)) / 2,
      frameHeight - (bodyHeight / this.player.scaleY) - 40
    );
  }

  private addInteractable(
    id: string, name: string, hint: string,
    x: number, y: number, w: number, h: number,
    color: number, alpha = 0.9, labelX?: number, labelY?: number,
  ) {
    const rect = this.add.rectangle(x, y, w, h, color, alpha)
      .setStrokeStyle(this.v(3), 0xf7d27d, alpha > 0 ? 0.45 : 0.0)
      .setDepth(19);
    const label = this.add.text(labelX ?? x, labelY ?? (y - h / 2 - this.v(28)), name, {
      fontFamily: 'VT323, monospace',
      fontSize: `${Math.round(this.v(24))}px`,
      color: '#f8e5b3',
      stroke: '#050408',
      strokeThickness: this.v(4),
    }).setOrigin(0.5).setDepth(25).setVisible(false);
    this.interactables.push({ id, name, hint, rect, label });
  }

  private refreshVisibility(state: StoryState) {
    for (const item of this.interactables) {
      const hasKey = state.inventory.includes('rusted_key');
      const hidden =
        (item.id === 'rat' && state.flags.ratPaid) ||
        (item.id === 'guard' && hasKey) ||
        (item.id === 'cell_exit' && !hasKey) ||
        (item.id === 'collect_coin' && state.flags.coinFound) ||
        (item.id === 'market_exit' && !state.inventory.includes('gate_pass')) ||
        (item.id === 'cathedral_exit' && state.scene === 'cathedral' && !state.flags.runeTaken && state.flags.silasChoice === 'none');

      item.rect.setVisible(!hidden);
      if (hidden) item.label.setVisible(false);
    }

    const ratVis = this.children.getByName('rat_visual') as Phaser.GameObjects.Image | null;
    if (ratVis) ratVis.setVisible(!state.flags.ratPaid);

    if (state.scene === 'cell' && this.bgImage) {
      const wantKey = state.inventory.includes('rusted_key') ? 'bg_cell_open' : 'bg_cell';
      if (this.bgImage.texture.key !== wantKey) this.bgImage.setTexture(wantKey);
    }
  }

  private updateNearestInteractable() {
    let nearest: Interactable | undefined;
    let nearestDist = 9999;

    // Hide all labels first
    for (const item of this.interactables) {
      item.label.setVisible(false);
    }

    for (const item of this.interactables) {
      if (!item.rect.visible) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, item.rect.x, item.rect.y,
      );
      if (dist < this.v(190) && dist < nearestDist) { nearest = item; nearestDist = dist; }
    }

    this.near = nearest;
    const showTutorial = this.settings?.gameplay.tutorialTooltips ?? true;
    if (nearest && showTutorial) {
      this.game.events.emit('interaction_prompt', `[${this.formatBinding('interact')}]  ${nearest.hint}`);
      nearest.label.setVisible(true);
    } else {
      this.game.events.emit('interaction_prompt', '');
    }
  }

  private emitAction(action: GameAction) {
    const volume = 0.5 * (this.settings?.audio.masterVolume ?? 1);
    if (action.type === 'collect') {
      this.sound.play('sfx_collect', { volume });
    } else {
      this.sound.play('sfx_interact', { volume });
    }
    this.shakeCamera(120, 0.0035);
    this.game.events.emit('game_action', action);
  }

  private rebuildActionKeys() {
    const bindings = {
      ...DEFAULT_KEY_BINDINGS,
      ...this.settings?.controls.keyBindings,
    } as Record<ControlAction, string>;

    this.actionKeys = {
      moveUp: this.input.keyboard!.addKey(this.toKeyCode(bindings.moveUp)),
      moveDown: this.input.keyboard!.addKey(this.toKeyCode(bindings.moveDown)),
      moveLeft: this.input.keyboard!.addKey(this.toKeyCode(bindings.moveLeft)),
      moveRight: this.input.keyboard!.addKey(this.toKeyCode(bindings.moveRight)),
      interact: this.input.keyboard!.addKey(this.toKeyCode(bindings.interact)),
      inventory: this.input.keyboard!.addKey(this.toKeyCode(bindings.inventory)),
    };
  }

  private toKeyCode(key: string) {
    const normalized = key.toUpperCase().replace(/\s+/g, '');
    if (normalized === ' ') return Phaser.Input.Keyboard.KeyCodes.SPACE;
    if (normalized === 'ARROWUP') return Phaser.Input.Keyboard.KeyCodes.UP;
    if (normalized === 'ARROWDOWN') return Phaser.Input.Keyboard.KeyCodes.DOWN;
    if (normalized === 'ARROWLEFT') return Phaser.Input.Keyboard.KeyCodes.LEFT;
    if (normalized === 'ARROWRIGHT') return Phaser.Input.Keyboard.KeyCodes.RIGHT;

    const keyCodes = Phaser.Input.Keyboard.KeyCodes as Record<string, number>;
    return keyCodes[normalized] ?? keyCodes[DEFAULT_KEY_BINDINGS.interact];
  }

  private formatBinding(action: ControlAction) {
    const key = this.settings?.controls.keyBindings[action] ?? DEFAULT_KEY_BINDINGS[action];
    return key.length === 1 ? key.toUpperCase() : key;
  }

  private shakeCamera(duration: number, intensity: number) {
    if (!(this.settings?.gameplay.cameraShake ?? true)) return;
    this.cameras.main.shake(duration, intensity);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const { width, height } = gameSize;
    const worldHeight = this.getWorldHeight();
    this.physics.world.setBounds(0, 0, this.physics.world.bounds.width, worldHeight);
    this.cameras.main.setBounds(0, 0, this.cameras.main.getBounds().width, height);
    this.cameras.main.setSize(width, height);
    if (this.currentState) this.rebuildScene(this.currentState);
  }

  private sceneStartX(scene: StorySceneId) {
    if (scene === 'cell') return 200;
    if (scene === 'gate') return 180;
    if (scene === 'outskirts') return 140;
    return 130;
  }
}
