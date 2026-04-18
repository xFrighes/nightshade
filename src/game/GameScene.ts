import * as Phaser from 'phaser';

interface NpcData {
  id: string;
  name: string;
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private npcList: NpcData[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private lastInteractTime = 0;

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('mood_bg', '/bg.png');
    this.load.atlas('player_anim', '/player_sheet.png', '/player_sheet.json');
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.image(width / 2, height / 2, 'mood_bg')
      .setScale(Math.max(width / 1920, height / 1080))
      .setTint(0xaaaaaa);

    // Ground zone - bottom 200px
    const groundHeight = 200;
    const groundY = height - groundHeight;
    this.add.rectangle(0, groundY, width, groundHeight, 0x14121e).setOrigin(0);

    // Ground line (visual separator between bg and ground)
    this.add.rectangle(0, groundY, width, 4, 0x2a2040).setOrigin(0);

    // 2.5D walk zone - player moves freely within this band
    const walkTop = groundY + 20;
    const walkH = groundHeight - 50;
    this.physics.world.setBounds(60, walkTop, width - 120, walkH);

    // Animations
    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: this.anims.generateFrameNames('player_anim', { prefix: 'idle_', start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1
      });
    }
    if (!this.anims.exists('player-walk')) {
      this.anims.create({
        key: 'player-walk',
        frames: this.anims.generateFrameNames('player_anim', { prefix: 'walk_', start: 0, end: 4 }),
        frameRate: 10,
        repeat: -1
      });
    }

    // Player - center of walk zone
    const playerStartY = walkTop + walkH / 2;
    this.player = this.physics.add.sprite(180, playerStartY, 'player_anim');
    this.player.setCollideWorldBounds(true);

    // Scale to 110px display height
    const scale = 110 / 500;
    this.player.setScale(scale);

    // Tight hitbox in world pixels
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setSize(50, 90);
    }

    this.player.play('player-idle');

    // NPCs
    this.createNPC('guide', 'Veteran Kaelen', width - 220, walkTop + 30, 0xe74c3c, 'spear');
    this.createNPC('merchant', 'Silas the Broker', Math.floor(width / 2), walkTop + 60, 0x9b59b6, 'hood');
    this.createNPC('contact', 'The Envoy', 480, walkTop + 20, 0x2ecc71, 'hood');

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Interact prompt (hidden by default)
    this.promptText = this.add.text(0, 0, '[E] Talk', {
      fontSize: '18px',
      color: '#f39c12',
      fontFamily: 'VT323',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5, 1).setVisible(false).setDepth(1000);

    // Atmosphere
    this.createStreetLamp(350, groundY - 60);
    this.createStreetLamp(width - 430, groundY - 60);

    this.add.rectangle(0, 0, width, height, 0x110022, 0.35).setOrigin(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private createNPC(id: string, name: string, x: number, y: number, color: number, type: string) {
    const char = this.createNPCObject(color, type);
    char.setPosition(x, y);
    char.setDepth(y);

    this.add.text(x, y - 72, name, {
      fontSize: '15px',
      color: '#ffffffcc',
      fontFamily: 'VT323',
      backgroundColor: '#00000077',
      padding: { x: 5, y: 2 }
    }).setOrigin(0.5, 1).setDepth(y + 1);

    this.npcList.push({ id, name, x, y });
  }

  private createNPCObject(color: number, type: string) {
    const c = this.add.container(0, 0);
    const sh = this.add.ellipse(0, 38, 48, 16, 0x000000, 0.65);
    const body = this.add.graphics().fillStyle(color, 1).lineStyle(3, 0x000000, 1);
    body.fillRoundedRect(-22, -28, 44, 64, 14).strokeRoundedRect(-22, -28, 44, 64, 14);
    const head = this.add.graphics().fillStyle(0xffdbac, 1).lineStyle(3, 0x000000, 1);
    head.fillCircle(0, -45, 20).strokeCircle(0, -45, 20);
    const extra = this.add.container(0, 0);
    if (type === 'spear') {
      extra.add([
        this.add.rectangle(-28, -15, 6, 130, 0x555555).setStrokeStyle(2, 0x000000),
        this.add.triangle(-28, -85, 0, 18, -10, 0, 10, 0, 0xbdc3c7).setStrokeStyle(2, 0x000000)
      ]);
    } else if (type === 'hood') {
      const h = this.add.graphics().fillStyle(0x1a1a2e, 1).lineStyle(3, 0x000000, 1);
      h.fillRoundedRect(-24, -68, 48, 45, 18).strokeRoundedRect(-24, -68, 48, 45, 18);
      extra.add(h);
    }
    c.add([sh, body, head, extra]);
    this.tweens.add({
      targets: [body, head, extra],
      y: '-=5',
      duration: 1000 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    return c;
  }

  private createStreetLamp(x: number, y: number) {
    this.add.rectangle(x, y + 80, 10, 160, 0x111111).setOrigin(0.5);
    this.add.rectangle(x + 18, y, 36, 6, 0x111111).setOrigin(0.5);
    const glow = this.add.circle(x + 36, y + 15, 70, 0xffaa00, 0.4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 0.7 },
      scale: { from: 0.9, to: 1.1 },
      duration: 2000,
      yoyo: true,
      repeat: -1
    });
  }

  update() {
    if (!this.player || !this.player.body) return;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0);

    const l = this.cursors.left.isDown || this.wasd.A.isDown;
    const r = this.cursors.right.isDown || this.wasd.D.isDown;
    const u = this.cursors.up.isDown || this.wasd.W.isDown;
    const d = this.cursors.down.isDown || this.wasd.S.isDown;

    if (l) { body.setVelocityX(-220); this.player.setFlipX(true); }
    else if (r) { body.setVelocityX(220); this.player.setFlipX(false); }
    if (u) body.setVelocityY(-160);
    else if (d) body.setVelocityY(160);

    this.player.play(l || r || u || d ? 'player-walk' : 'player-idle', true);
    this.player.setDepth(this.player.y);

    // Proximity to NPCs
    let nearest: NpcData | null = null;
    let minDist = 140;
    for (const npc of this.npcList) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < minDist) { minDist = dist; nearest = npc; }
    }

    if (nearest) {
      this.promptText.setPosition(nearest.x, nearest.y - 80).setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        const now = Date.now();
        if (now - this.lastInteractTime > 1500) {
          this.lastInteractTime = now;
          this.game.events.emit('npc_near', { id: nearest.id, name: nearest.name });
        }
      }
    } else {
      this.promptText.setVisible(false);
    }
  }
}
