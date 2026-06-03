// GameScene.js — Main gameplay scene.
// All systems live here: movement, auto-attack, enemies, debuffs, augments, XP, boss, win/death.

class GameScene extends Phaser.Scene {
    constructor() {
        super('gameScene');
    }

    // ================================================================
    //  CREATE
    // ================================================================

    create() {
        // Overridden by setupTilemap() once the map loads
        this.WORLD_W = 0;
        this.WORLD_H = 0;

        // Game state
        this.gameTime    = 0;
        this.gameActive  = true;
        this.bossSpawned = false;
        this.bossAlive   = false;
        this.level       = 1;
        this.xp          = 0;
        this.xpRequired  = 50;
        this.poolCounter = 0;

        // upgradeLevels tracks every upgrade — stats and augments — by level
        // e.g. { damage: 3, freeze: 1, shield: 2, wand: 4 }
        this.upgradeLevels = {};

        this.initStats();

        this.setupTilemap();
        this.createPlayer();
        this.createEnemyAnimations();
        this.setupGroups();
        this.setupCollisions();
        this.setupTimers();
        this.setupCamera();  // must be before setupHUD so uiCamera exists
        this.setupHUD();

        // Wire cameras: main (zoom 1.8) ignores HUD; fixed UI camera ignores world
        this.cameras.main.ignore(this.hudElements);
        const worldIgnore = [this.player, ...this.mapLayers];
        this.uiCamera.ignore(worldIgnore);

        this.setupInput();
        this.events.on('resume', this.onResume, this);
        this.startMusic('game_music');
        this.setupDebug();
    }

    // ================================================================
    //  AUDIO HELPERS
    // ================================================================

    playSound(key, config = {}) {
        if (!this.cache.audio.has(key)) return;
        const sfxVol = this.game.registry.get('sfxVolume') ?? 0.7;
        this.sound.play(key, { ...config, volume: (config.volume ?? 1) * sfxVol });
    }

    startMusic(key) {
        if (this.bgm) { this.bgm.stop(); this.bgm.destroy(); }
        if (this.cache.audio.has(key)) {
            const vol = this.game.registry.get('musicVolume') ?? 0.5;
            this.bgm  = this.sound.add(key, { volume: vol, loop: true });
            this.bgm.play();
        } else {
            this.bgm = null;
        }
    }

    stopMusic() {
        if (this.bgm) this.bgm.stop();
    }

    // ================================================================
    //  STATS — base values per class; modified by upgrades at runtime
    // ================================================================

    initStats() {
        this.stats = {
            maxHp: 100, hp: 100,
            hpRegen: 1,
            moveSpeed: 200,
            damage: 10,
            attackCooldown: 1000,
            pickupRange: 80,
            critChance: 0.10,
            critDamage: 1.5,
            luck: 0,
            extraShots: 0,
            cooldownMult: 1.0
        };
        this.lastAttackTime   = 0;
        this.regenAccumulator = 0;
        this.shieldCharges    = 0;    // current available blocks (Shield augment)
        this.shieldRecharging = false;
        this.auraAngle        = 0;    // rotation state for Aura rings
        this.auraGraphics     = null;
        this.shieldVisual     = null;
        // Music Notes buff state
        this.musicBuff       = { active: false, speedApplied: 0, dmgApplied: 0, cdApplied: 0 };
        this.musicBuffTimer  = null;
        this.musicKillStacks = 0; // Lv3 — stacks from kills (diminishing / detrimental)
        // OmniVamp stolen-stat stacks (max 5)
        this.omnivampStacks  = 0;
        this.bombTimer       = null;

        this.isAttacking      = false; // prevents walk/idle interrupting attack anim
        this.isHurt           = false; // prevents other anims interrupting hurt anim
        this.isDead           = false;
        this.attackToggle     = false; // alternates between Attack1 and Attack2
    }

    setupTilemap() {
        this.mapLayers = [];

        this.map     = this.make.tilemap({ key: 'map' });
        this.WORLD_W = this.map.widthInPixels;
        this.WORLD_H = this.map.heightInPixels;

        const tilesets = [
            this.map.addTilesetImage('TileSet',            'TileSet'),
            this.map.addTilesetImage('Trees',              'Trees'),
            this.map.addTilesetImage('WaterTiles-6frames', 'WaterTiles-6frames'),
            this.map.addTilesetImage('Props',              'Props'),
        ].filter(Boolean);

        ['Ground', 'Base'].forEach((name, i) => {
            if (!this.map.getLayer(name)) return;
            const layer = this.map.createLayer(name, tilesets, 0, 0).setDepth(i);
            this.mapLayers.push(layer);
        });
    }

    // ================================================================
    //  PLAYER
    // ================================================================

    createPlayer() {
        const spawnX = this._tiledSpawn ? this._tiledSpawn.x : this.WORLD_W / 2;
        const spawnY = this._tiledSpawn ? this._tiledSpawn.y : this.WORLD_H / 2;
        this.player  = this.physics.add.sprite(spawnX, spawnY, 'soldier_idle');
        this.player.setCollideWorldBounds(true).setDepth(10);
        this.player.body.setSize(14, 18);
        this.player.body.setOffset(41, 57);
        this.createPlayerAnimations();
        this.player.play('player_idle');
    }

    createPlayerAnimations() {
        if (this.anims.exists('player_idle')) return; // already registered
        this.anims.create({ key: 'player_idle',    frames: this.anims.generateFrameNumbers('soldier_idle',    { start: 0, end: 5 }), frameRate: 8,  repeat: -1 });
        this.anims.create({ key: 'player_walk',    frames: this.anims.generateFrameNumbers('soldier_walk',    { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'player_attack1', frames: this.anims.generateFrameNumbers('soldier_attack1', { start: 0, end: 7 }), frameRate: 14, repeat: 0  });
        this.anims.create({ key: 'player_attack2', frames: this.anims.generateFrameNumbers('soldier_attack2', { start: 0, end: 7 }), frameRate: 14, repeat: 0  });
        this.anims.create({ key: 'player_hurt',    frames: this.anims.generateFrameNumbers('soldier_hurt',    { start: 0, end: 3 }), frameRate: 12, repeat: 0  });
        this.anims.create({ key: 'player_death',   frames: this.anims.generateFrameNumbers('soldier_death',   { start: 0, end: 9 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'player_block',   frames: this.anims.generateFrameNumbers('soldier_block',   { start: 0, end: 5 }), frameRate: 12, repeat: 0  });
    }

    createEnemyAnimations() {
        if (this.anims.exists('mino_idle')) return;

        // Minotaur — 128×96 frames, 8 cols × 20 rows (right-facing rows 0–9)
        this.anims.create({ key: 'mino_idle',   frames: this.anims.generateFrameNumbers('minotaur', { start: 0,  end: 4  }), frameRate: 6,  repeat: -1 });
        this.anims.create({ key: 'mino_move',   frames: this.anims.generateFrameNumbers('minotaur', { start: 8,  end: 15 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'mino_attack', frames: this.anims.generateFrameNumbers('minotaur', { start: 24, end: 31 }), frameRate: 12, repeat: 0  });
        this.anims.create({ key: 'mino_hurt',   frames: this.anims.generateFrameNumbers('minotaur', { start: 56, end: 58 }), frameRate: 12, repeat: 0  });
        this.anims.create({ key: 'mino_death',  frames: this.anims.generateFrameNumbers('minotaur', { start: 72, end: 77 }), frameRate: 8,  repeat: 0  });

        // Flying Eye — all frames 150×150
        this.anims.create({ key: 'eye_flight', frames: this.anims.generateFrameNumbers('eye_flight', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'eye_attack', frames: this.anims.generateFrameNumbers('eye_attack', { start: 0, end: 7 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'eye_hit',    frames: this.anims.generateFrameNumbers('eye_hit',    { start: 0, end: 3 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'eye_death',  frames: this.anims.generateFrameNumbers('eye_death',  { start: 0, end: 3 }), frameRate: 8,  repeat: 0  });

        // Goblin
        this.anims.create({ key: 'gob_run',    frames: this.anims.generateFrameNumbers('gob_run',    { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'gob_attack', frames: this.anims.generateFrameNumbers('gob_attack', { start: 0, end: 7 }), frameRate: 12, repeat: 0  });
        this.anims.create({ key: 'gob_idle',   frames: this.anims.generateFrameNumbers('gob_idle',   { start: 0, end: 3 }), frameRate: 6,  repeat: -1 });
        this.anims.create({ key: 'gob_hit',    frames: this.anims.generateFrameNumbers('gob_hit',    { start: 0, end: 3 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'gob_death',  frames: this.anims.generateFrameNumbers('gob_death',  { start: 0, end: 3 }), frameRate: 8,  repeat: 0  });

        // Mushroom
        this.anims.create({ key: 'mush_run',    frames: this.anims.generateFrameNumbers('mush_run',    { start: 0, end: 7 }), frameRate: 8,  repeat: -1 });
        this.anims.create({ key: 'mush_attack', frames: this.anims.generateFrameNumbers('mush_attack', { start: 0, end: 7 }), frameRate: 8,  repeat: 0  });
        this.anims.create({ key: 'mush_idle',   frames: this.anims.generateFrameNumbers('mush_idle',   { start: 0, end: 3 }), frameRate: 6,  repeat: -1 });
        this.anims.create({ key: 'mush_hit',    frames: this.anims.generateFrameNumbers('mush_hit',    { start: 0, end: 3 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'mush_death',  frames: this.anims.generateFrameNumbers('mush_death',  { start: 0, end: 3 }), frameRate: 8,  repeat: 0  });

        // Skeleton
        this.anims.create({ key: 'skel_walk',   frames: this.anims.generateFrameNumbers('skel_walk',   { start: 0, end: 3 }), frameRate: 8,  repeat: -1 });
        this.anims.create({ key: 'skel_attack', frames: this.anims.generateFrameNumbers('skel_attack', { start: 0, end: 7 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'skel_idle',   frames: this.anims.generateFrameNumbers('skel_idle',   { start: 0, end: 3 }), frameRate: 6,  repeat: -1 });
        this.anims.create({ key: 'skel_shield', frames: this.anims.generateFrameNumbers('skel_shield', { start: 0, end: 3 }), frameRate: 6,  repeat: -1 });
        this.anims.create({ key: 'skel_hit',    frames: this.anims.generateFrameNumbers('skel_hit',    { start: 0, end: 3 }), frameRate: 10, repeat: 0  });
        this.anims.create({ key: 'skel_death',  frames: this.anims.generateFrameNumbers('skel_death',  { start: 0, end: 3 }), frameRate: 8,  repeat: 0  });
    }

    // ================================================================
    //  GROUPS
    // ================================================================

    setupGroups() {
        this.enemies        = this.physics.add.group();
        this.xpOrbs         = this.physics.add.group();
        this.deathPoolGroup = this.physics.add.staticGroup();
    }

    // ================================================================
    //  COLLISIONS
    // ================================================================

    setupCollisions() {
        this.physics.add.overlap(this.player,         this.enemies,    this.onEnemyTouchPlayer, null, this);
        this.physics.add.overlap(this.deathPoolGroup, this.enemies,    this.onPoolHitEnemy,     null, this);
    }

    // ================================================================
    //  TIMERS
    // ================================================================

    setupTimers() {
        this.spawnTimer = this.time.addEvent({ delay: 3000, callback: this.spawnEnemy, callbackScope: this, loop: true });
        this.time.addEvent({ delay: 30000, callback: this.updateSpawnRate, callbackScope: this, loop: true });
    }

    updateSpawnRate() {
        const newDelay = Math.max(800, 3000 - this.getDifficulty() * 600);
        this.spawnTimer.reset({ delay: newDelay, callback: this.spawnEnemy, callbackScope: this, loop: true });
    }

    // ================================================================
    //  HUD
    // ================================================================

    setupHUD() {
        this.hudElements = [];
        const W = this.scale.width;
        const H = this.scale.height;
        // hud() registers each element so the main camera can ignore them
        const hud = el => { this.hudElements.push(el); return el; };

        this.timerText   = hud(this.add.text(W / 2, 16, '0:00 / 15:00', { fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(100));
        this.levelText   = hud(this.add.text(W - 16, 16, 'Lv. 1',        { fontSize: '18px', color: '#ffcc44', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0).setDepth(100));
        this.augmentText = hud(this.add.text(16, 16, '',                  { fontSize: '15px', color: '#aaffaa', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0).setDepth(100));

        // HP bar
        hud(this.add.rectangle(W / 2, H - 30, 400, 14, 0x330000).setDepth(100).setOrigin(0.5));
        this.hpBarFill = hud(this.add.rectangle(W / 2 - 200, H - 30, 400, 14, 0x22cc44).setDepth(101).setOrigin(0, 0.5));
        this.hpText    = hud(this.add.text(W / 2, H - 30, '', { fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setDepth(102));

        // XP bar
        hud(this.add.rectangle(W / 2, H - 12, 400, 10, 0x112200).setDepth(100).setOrigin(0.5));
        this.xpBarFill = hud(this.add.rectangle(W / 2 - 200, H - 12, 0, 10, 0x44ff88).setDepth(101).setOrigin(0, 0.5));

        // Boss HP bar (hidden until boss spawns)
        this.bossBarBg   = hud(this.add.rectangle(W / 2, 60, 500, 18, 0x330000).setDepth(100).setOrigin(0.5).setVisible(false));
        this.bossBarFill = hud(this.add.rectangle(W / 2 - 250, 60, 500, 18, 0xff4400).setDepth(101).setOrigin(0, 0.5).setVisible(false));
        this.bossLabel   = hud(this.add.text(W / 2, 60, 'BOSS', { fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(102).setVisible(false));

        // Shield charge display (top right, below level text)
        this.shieldHudText = hud(this.add.text(W - 16, 40, '', { fontSize: '14px', color: '#88ccff', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0).setDepth(100));

        this.updateHUD();
    }

    updateHUD() {
        const mins = Math.floor(this.gameTime / 60);
        const secs = String(Math.floor(this.gameTime % 60)).padStart(2, '0');
        this.timerText.setText(`${mins}:${secs} / 15:00`);
        this.levelText.setText(`Lv. ${this.level}`);

        const hpRatio  = Math.max(0, this.stats.hp / this.stats.maxHp);
        this.hpBarFill.setDisplaySize(400 * hpRatio, 14);
        this.hpBarFill.setFillStyle(hpRatio > 0.5 ? 0x22cc44 : hpRatio > 0.25 ? 0xffaa00 : 0xff2222);
        this.hpText.setText(`${Math.ceil(this.stats.hp)} / ${this.stats.maxHp} HP`);

        this.xpBarFill.setDisplaySize(400 * Math.min(1, this.xp / this.xpRequired), 10);

        if (this.bossAlive && this.bossRef?.active) {
            this.bossBarFill.setDisplaySize(500 * Math.max(0, this.bossRef.hp / this.bossRef.maxHp), 18);
        }

        // Shield counter
        const shieldLv = this.augLevel('shield');
        if (shieldLv > 0) {
            this.shieldHudText.setText(`🛡 ${this.shieldCharges}/${shieldLv}`);
        }
    }

    // ================================================================
    //  CAMERA / INPUT
    // ================================================================

    setupCamera() {
        const W = this.scale.width;
        const H = this.scale.height;

        // Physics world — player and enemies stay inside the map
        this.physics.world.setBounds(0, 0, this.WORLD_W, this.WORLD_H);

        // Game camera — follows player at zoom 1.8, clamped to map edges
        const cam = this.cameras.main;
        cam.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
        cam.setZoom(1.8);
        cam.startFollow(this.player, false, 0.1, 0.1);

        // UI camera — fixed at screen origin, zoom 1, renders HUD only
        this.uiCamera = this.cameras.add(0, 0, W, H).setName('ui').setZoom(1);
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd    = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W, down:  Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    // ================================================================
    //  UPDATE — main loop
    // ================================================================

    update(time, delta) {
        if (!this.gameActive) return;

        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.scene.pause('gameScene');
            this.scene.launch('settingsScene', { fromScene: 'gameScene' });
            return;
        }

        const dt = delta / 1000;
        this.gameTime += dt;

        this.handleMovement();
        this.handleAutoAttack(time);
        this.handleHpRegen(dt);
        this.handleXpMagnet();
        this.handleEnemyAI(time);
        this.updateDebuffs(time);
        this.handleAura(dt);
        this.handleShieldVisual();
        this.checkBossSpawn();
        this.updateHUD();
    }

    // ================================================================
    //  MOVEMENT
    // ================================================================

    handleMovement() {
        const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
        const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;

        let vx = (right ? 1 : 0) - (left ? 1 : 0);
        let vy = (down  ? 1 : 0) - (up   ? 1 : 0);

        if (vx !== 0 || vy !== 0) {
            const len = Math.sqrt(vx * vx + vy * vy);
            this.player.body.setVelocity((vx / len) * this.stats.moveSpeed, (vy / len) * this.stats.moveSpeed);
        } else {
            const vel = this.player.body.velocity;
            this.player.body.setVelocity(vel.x * 0.8, vel.y * 0.8);
        }

        if (vx < 0)      this.player.setFlipX(true);
        else if (vx > 0) this.player.setFlipX(false);

        // Drive walk / idle animation — don't interrupt attack or hurt
        if (!this.isAttacking && !this.isHurt && !this.isDead) {
            const moving  = vx !== 0 || vy !== 0;
            const current = this.player.anims.currentAnim?.key;
            if (moving  && current !== 'player_walk') this.player.play('player_walk');
            if (!moving && current !== 'player_idle') this.player.play('player_idle');
        }
    }

    // ================================================================
    //  AUTO-ATTACK
    // ================================================================

    handleAutoAttack(time) {
        if (time - this.lastAttackTime < this.stats.attackCooldown) return;
        this.performMeleeSwing();
        this.lastAttackTime = time;
        if (this.augLevel('musicNotes')) this.triggerMusicBuff();
    }

    // Soldier: play attack animation then apply damage at the visual hit frame
    performMeleeSwing() {
        this.isAttacking  = true;
        const animKey     = this.attackToggle ? 'player_attack2' : 'player_attack1';
        this.attackToggle = !this.attackToggle;
        this.player.play(animKey, true);
        this.player.once('animationcomplete', () => { this.isAttacking = false; });

        // Face toward the nearest enemy before the swing lands
        const nearest = this.getClosestEnemies(1)[0];
        if (nearest) this.player.setFlipX(nearest.body.center.x < this.player.body.center.x);

        // Delay damage to the hit frame — frame 4 of 8 at 14 fps ≈ 285 ms
        this.time.delayedCall(285, () => { if (this.gameActive) this.doMeleeHit(); });
    }

    // Applies melee damage to all enemies in range — called at the hit frame
    doMeleeHit() {
        const meleeRange = 75 + this.stats.extraShots * 10;
        // Use body.center for accurate world position (offset from sprite origin)
        const px = this.player.body.center.x;
        const py = this.player.body.center.y;
        const inRange = this.enemies.getChildren().filter(e =>
            e.active && Phaser.Math.Distance.Between(px, py, e.body.center.x, e.body.center.y) <= meleeRange
        );

        if (!inRange.length) return;
        this.playSound('hit', { volume: 0.5 });

        // Visual sword-impact ring at the player's attack position
        const ring = this.add.circle(px, py, meleeRange * 0.6, 0xffffff, 0.35).setDepth(15);
        this.tweens.add({ targets: ring, alpha: 0, scaleX: 1.4, scaleY: 1.4, duration: 200,
            onComplete: () => ring.destroy() });

        inRange.forEach(enemy => {
            const ex = enemy.x, ey = enemy.y;
            const prevHp = enemy.hp;

            const isCrit = Math.random() < this.stats.critChance;
            const dmg    = isCrit ? this.stats.damage * this.stats.critDamage : this.stats.damage;

            if (this.augLevel('freeze') && Math.random() < 0.25) {
                this.applyDebuff(enemy, 'slow', 1 + this.augLevel('freeze'));
            }

            // Fire Attack — apply burning DOT on hit
            if (this.augLevel('fireAttack')) {
                const fireLv = this.augLevel('fireAttack');
                const stacks   = fireLv >= 2 ? 3 : 2;
                const duration = [3000, 4500, 5000][fireLv - 1];
                if (!enemy.debuffs) enemy.debuffs = {};
                enemy.debuffs.fire = {
                    stacks:   Math.min(5, (enemy.debuffs.fire?.stacks || 0) + stacks),
                    lastTick: this.time.now,
                    expiry:   this.time.now + duration
                };
                enemy.setTint(0xff6600);
            }

            this.applyDamageToEnemy(enemy, dmg);

            // OmniVamp — heal for a % of damage dealt
            if (this.augLevel('omnivamp')) {
                const vampPcts = [0.03, 0.07, 0.12];
                const healPct  = vampPcts[this.augLevel('omnivamp') - 1] + this.omnivampStacks * 0.01;
                this.stats.hp  = Math.min(this.stats.maxHp, this.stats.hp + dmg * healPct);
            }

            if (this.augLevel('chain')) {
                let excluded = [...inRange];
                for (let c = 0; c < this.augLevel('chain'); c++) {
                    const ct = this.findNearestEnemy(ex, ey, excluded);
                    if (!ct) break;
                    excluded.push(ct);
                    this.applyDamageToEnemy(ct, dmg * 0.6);
                }
            }

            if (this.augLevel('overkill') && prevHp > 0 && prevHp < dmg) {
                const excess = dmg - prevHp;
                const radius = 80 + this.augLevel('overkill') * 20;
                this.enemies.getChildren().forEach(other => {
                    if (inRange.includes(other) || other === enemy) return;
                    if (Phaser.Math.Distance.Between(ex, ey, other.x, other.y) < radius) {
                        this.applyDamageToEnemy(other, excess);
                    }
                });
            }
        });

        // Double Strike — follow-up hit 200ms after primary swing
        if (this.augLevel('doubleStrike') && inRange.length) {
            const dsLv  = this.augLevel('doubleStrike');
            const dsMult = 0.30 + dsLv * 0.10; // 40%, 50%, 60%, 70%
            this.time.delayedCall(200, () => {
                if (!this.gameActive) return;
                const pxd = this.player.body.center.x, pyd = this.player.body.center.y;
                const dsTargets = this.enemies.getChildren().filter(e =>
                    e.active && Phaser.Math.Distance.Between(pxd, pyd, e.body.center.x, e.body.center.y) <= meleeRange * 0.9
                );
                if (!dsTargets.length) return;
                this.playSound('hit', { volume: 0.3 });
                dsTargets.forEach(enemy => {
                    this.applyDamageToEnemy(enemy, this.stats.damage * dsMult, true);
                    if (dsLv >= 4) {
                        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                        enemy.body.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
                    }
                });
            });
        }
    }

    // Returns up to n closest enemies, sorted by distance
    getClosestEnemies(n) {
        const px = this.player.body.center.x;
        const py = this.player.body.center.y;
        return this.enemies.getChildren()
            .filter(e => e.active)
            .map(e => ({ e, d: Phaser.Math.Distance.Between(px, py, e.body.center.x, e.body.center.y) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, n)
            .map(x => x.e);
    }

    findNearestEnemy(fromX, fromY, exclude) {
        let nearest = null, best = Infinity;
        this.enemies.getChildren().forEach(e => {
            if (exclude.includes(e)) return;
            const d = Phaser.Math.Distance.Between(fromX, fromY, e.x, e.y);
            if (d < best) { best = d; nearest = e; }
        });
        return nearest;
    }

    // ================================================================
    //  HP REGEN
    // ================================================================

    handleHpRegen(dt) {
        if (this.stats.hp >= this.stats.maxHp) return;
        this.regenAccumulator += this.stats.hpRegen * dt;
        if (this.regenAccumulator >= 1) {
            const r = Math.floor(this.regenAccumulator);
            this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + r);
            this.regenAccumulator -= r;
        }
    }

    // ================================================================
    //  XP MAGNET
    // ================================================================

    handleXpMagnet() {
        const { x: px, y: py } = this.player;
        this.xpOrbs.getChildren().forEach(orb => {
            const dist = Phaser.Math.Distance.Between(orb.x, orb.y, px, py);
            if (dist < this.stats.pickupRange) this.physics.moveTo(orb, px, py, 280);
            else                               orb.body.setVelocity(0, 0);
            if (dist < 18) {
                this.playSound('xp_collect', { volume: 0.2 });
                this.collectXp(orb.xpValue || 10);
                orb.destroy();
            }
        });
    }

    // ================================================================
    //  ENEMY SPAWNING
    // ================================================================

    spawnEnemy() {
        if (!this.gameActive || this.bossSpawned) return;
        const pos  = this.getSpawnPosition();
        const diff = this.getDifficulty();
        const r    = Math.random();
        let type;
        if      (diff < 1) type = r < 0.5 ? 'eye' : 'goblin';
        else if (diff < 2) type = r < 0.25 ? 'eye' : r < 0.5 ? 'goblin' : r < 0.75 ? 'mushroom' : 'skeleton';
        else               type = r < 0.2  ? 'eye' : r < 0.4 ? 'goblin' : r < 0.6  ? 'mushroom' : r < 0.8 ? 'skeleton' : 'minotaur';

        if      (type === 'eye')      this.createFlyingEye(pos.x, pos.y, diff);
        else if (type === 'goblin')   this.createGoblin(pos.x, pos.y, diff);
        else if (type === 'mushroom') this.createMushroom(pos.x, pos.y, diff);
        else if (type === 'skeleton') this.createSkeleton(pos.x, pos.y, diff);
        else                          this.createMinotaur(pos.x, pos.y, diff);
    }

    getSpawnPosition() {
        const cam  = this.cameras.main;
        const zoom = cam.zoom;
        const m    = 80;
        // Divide by zoom to get world-space dimensions of the visible area
        const visW = cam.width  / zoom;
        const visH = cam.height / zoom;
        const l = Math.max(0,            cam.scrollX - m);
        const t = Math.max(0,            cam.scrollY - m);
        const r = Math.min(this.WORLD_W, cam.scrollX + visW + m);
        const b = Math.min(this.WORLD_H, cam.scrollY + visH + m);
        const s = Phaser.Math.Between(0, 3);
        return [
            { x: Phaser.Math.Between(l, r), y: t },
            { x: Phaser.Math.Between(l, r), y: b },
            { x: l, y: Phaser.Math.Between(t, b) },
            { x: r, y: Phaser.Math.Between(t, b) }
        ][s];
    }

    getDifficulty() { return Math.min(3, this.gameTime / 300); }

    createRusher(x, y, diff) {
        const e = this.enemies.create(x, y, 'enemy_rusher');
        e.setDepth(8).setDisplaySize(80, 80);
        e.body.setSize(24, 24).setOffset(28, 28);
        e.enemyType = 'rusher'; e.maxHp = 20 + diff * 15; e.hp = e.maxHp;
        e.moveSpeed = 110 + diff * 30; e.damage = 10 + diff * 5; e.xpValue = 8;
        e.lastMeleeTime = 0; e.isBiting = false; e.isDying = false; e.debuffs = {};
        if (diff > 2) e.setTint(0xff8844); else if (diff > 1) e.setTint(0xff4444);
        return e;
    }

    createShooter(x, y, diff) {
        const e = this.enemies.create(x, y, 'enemy_shooter');
        e.setDepth(8).setDisplaySize(80, 80);
        e.body.setSize(50, 50).setOffset(0, 0);
        e.enemyType = 'shooter'; e.maxHp = 25 + diff * 12; e.hp = e.maxHp;
        e.moveSpeed = 80 + diff * 20; e.damage = 8 + diff * 3; e.xpValue = 12;
        e.attackCooldown = Math.max(600, 1500 - diff * 200); e.lastAttackTime = 0;
        e.isDying = false; e.debuffs = {};
        if (diff > 2) e.setTint(0x4499ff); else if (diff > 1) e.setTint(0x2266dd);
        return e;
    }

    createArcer(x, y, diff) {
        const e = this.enemies.create(x, y, 'enemy_arcer');
        e.setDepth(8).setDisplaySize(80, 80);
        e.body.setSize(50, 50).setOffset(0, 0);
        e.enemyType = 'arcer'; e.maxHp = 30 + diff * 14; e.hp = e.maxHp;
        e.moveSpeed = 90 + diff * 22; e.damage = 12 + diff * 4; e.xpValue = 15;
        e.attackCooldown = Math.max(800, 2000 - diff * 300); e.lastAttackTime = 0;
        e.isDying = false; e.debuffs = {};
        if (diff > 2) e.setTint(0x66ff88); else if (diff > 1) e.setTint(0x33aa55);
        return e;
    }


    createFlyingEye(x, y, diff) {
        const e = this.enemies.create(x, y, 'eye_flight');
        e.setDepth(8).setDisplaySize(75, 75);
        e.body.setSize(24, 22).setOffset(63, 64);
        e.enemyType = 'eye'; e.maxHp = 35 + diff * 12; e.hp = e.maxHp;
        e.moveSpeed = 130 + diff * 20; e.damage = 8 + diff * 3; e.xpValue = 12;
        e.attackCooldown = Math.max(800, 1500 - diff * 200); e.lastAttackTime = 0;
        e.isAttacking = false; e.isHurt = false; e.isDying = false; e.debuffs = {};
        e.play('eye_flight');
        return e;
    }

    createGoblin(x, y, diff) {
        const e = this.enemies.create(x, y, 'gob_run');
        e.setDepth(8).setDisplaySize(75, 75);
        e.body.setSize(20, 28).setOffset(65, 61);
        e.enemyType = 'goblin'; e.maxHp = 45 + diff * 12; e.hp = e.maxHp;
        e.moveSpeed = 120 + diff * 18; e.damage = 10 + diff * 3; e.xpValue = 10;
        e.attackCooldown = Math.max(700, 1400 - diff * 200); e.lastAttackTime = 0;
        e.isAttacking = false; e.isHurt = false; e.isDying = false; e.debuffs = {};
        e.play('gob_run');
        return e;
    }

    createMushroom(x, y, diff) {
        const e = this.enemies.create(x, y, 'mush_run');
        e.setDepth(8).setDisplaySize(80, 80);
        e.body.setSize(22, 28).setOffset(64, 61);
        e.enemyType = 'mushroom'; e.maxHp = 90 + diff * 25; e.hp = e.maxHp;
        e.moveSpeed = 55 + diff * 10; e.damage = 18 + diff * 5; e.xpValue = 18;
        e.attackCooldown = Math.max(1200, 2000 - diff * 250); e.lastAttackTime = 0;
        e.isAttacking = false; e.isHurt = false; e.isDying = false; e.debuffs = {};
        e.play('mush_run');
        return e;
    }

    createSkeleton(x, y, diff) {
        const e = this.enemies.create(x, y, 'skel_walk');
        e.setDepth(8).setDisplaySize(80, 80);
        e.body.setSize(20, 30).setOffset(65, 60);
        e.enemyType = 'skeleton'; e.maxHp = 65 + diff * 18; e.hp = e.maxHp;
        e.moveSpeed = 80 + diff * 14; e.damage = 12 + diff * 4; e.xpValue = 15;
        e.attackCooldown = Math.max(1000, 1800 - diff * 250); e.lastAttackTime = 0;
        e.isAttacking = false; e.isHurt = false; e.isDying = false; e.debuffs = {};
        e.play('skel_walk');
        return e;
    }

    createMinotaur(x, y, diff) {
        const e = this.enemies.create(x, y, 'minotaur');
        e.setDepth(8).setDisplaySize(80, 60); // preserves 128:96 = 4:3 ratio
        e.body.setSize(24, 24).setOffset(52, 36);
        e.enemyType = 'minotaur'; e.maxHp = 80 + diff * 30; e.hp = e.maxHp;
        e.moveSpeed = 65 + diff * 15; e.damage = 20 + diff * 8; e.xpValue = 30;
        e.attackCooldown = Math.max(1000, 2200 - diff * 300); e.lastAttackTime = 0;
        e.isAttacking = false; e.isHurt = false; e.isDying = false; e.debuffs = {};
        e.play('mino_idle');
        return e;
    }

    // ================================================================
    //  BOSS
    // ================================================================

    checkBossSpawn() {
        if (!this.bossSpawned && this.gameTime >= 900) {
            this.bossSpawned = true;
            this.spawnTimer.paused = true;
            this.spawnBoss();
        }
    }

    spawnBoss() {
        const cam = this.cameras.main;
        const boss = this.enemies.create(
            Math.min(cam.scrollX + cam.width + 80, this.WORLD_W - 80),
            Phaser.Math.Clamp(cam.scrollY + cam.height / 2, 80, this.WORLD_H - 80),
            'enemy_boss'
        );
        boss.setDepth(9).setDisplaySize(120, 120);
        boss.body.setSize(40, 40).setOffset(12, 12);
        boss.enemyType = 'boss'; boss.maxHp = 1000; boss.hp = 1000;
        boss.moveSpeed = 120; boss.damage = 20; boss.xpValue = 500;
        boss.isDying = false; boss.isBiting = false; boss.lastMeleeTime = 0; boss.debuffs = {};

        this.bossRef = boss; this.bossAlive = true;
        this.bossBarBg.setVisible(true); this.bossBarFill.setVisible(true); this.bossLabel.setVisible(true);
        this.startMusic('boss_music');
        this.cameras.main.flash(500, 255, 100, 0);
        // Boss text lives on the UI camera (main camera ignores it)
        const bossText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, '⚠ BOSS APPEARED ⚠',
            { fontSize: '36px', color: '#ff4400', stroke: '#000', strokeThickness: 5 }
        ).setDepth(200).setOrigin(0.5);
        this.cameras.main.ignore(bossText);
        this.time.delayedCall(3000, () => { if (bossText.active) bossText.destroy(); });
    }

    // ================================================================
    //  ENEMY AI
    // ================================================================

    handleEnemyAI(time) {
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.isDying) return;
            // Frozen enemies can't move
            if (enemy.debuffs.freeze) {
                enemy.body.setVelocity(0, 0);
                // Wolf idles visually while frozen
                return;
            }

            // Slow reduces movement speed (20% per stack, cap at 5 stacks = freeze)
            const slowStacks = enemy.debuffs.slow?.stacks || 0;
            enemy.currentSpeed = enemy.moveSpeed * Math.max(0.0, 1 - slowStacks * 0.2);

            switch (enemy.enemyType) {
                case 'eye':      this.aiFlyingEye(enemy, time);  break;
                case 'goblin':   this.aiGoblin(enemy, time);     break;
                case 'mushroom': this.aiMushroom(enemy, time);   break;
                case 'skeleton': this.aiSkeleton(enemy, time);   break;
                case 'minotaur': this.aiMinotaur(enemy, time);   break;
                case 'rusher':   this.aiRusher(enemy);           break;
                case 'shooter':  this.aiShooter(enemy, time);    break;
                case 'arcer':    this.aiArcer(enemy, time);      break;
                case 'boss':     this.aiBoss(enemy, time);       break;
            }
        });
    }

    aiRusher(enemy) {
        if (enemy.isBiting) return;

        // Vampire Survivors seek: normalize direction vector, apply speed, derive rotation
        const dx   = this.player.x - enemy.x;
        const dy   = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            enemy.body.setVelocity((dx / dist) * enemy.currentSpeed, (dy / dist) * enemy.currentSpeed);
            enemy.setFlipX(dx < 0);
        }
    }

    // Boar: seeks player, melee on contact
    aiShooter(enemy, time) {
        const dx   = this.player.x - enemy.x;
        const dy   = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            enemy.body.setVelocity((dx / dist) * enemy.currentSpeed, (dy / dist) * enemy.currentSpeed);
            enemy.setFlipX(dx < 0);
        }
        if (dist <= 100 && time - enemy.lastAttackTime >= enemy.attackCooldown) {
            enemy.lastAttackTime = time;
            this.damagePlayer(enemy.damage);
            this.cameras.main.flash(60, 255, 80, 0);
        }
    }

    // Badger: seeks player, melee on contact
    aiArcer(enemy, time) {
        const dx   = this.player.x - enemy.x;
        const dy   = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            enemy.body.setVelocity((dx / dist) * enemy.currentSpeed, (dy / dist) * enemy.currentSpeed);
            enemy.setFlipX(dx < 0);
        }
        if (dist <= 100 && time - enemy.lastAttackTime >= enemy.attackCooldown) {
            enemy.lastAttackTime = time;
            this.damagePlayer(enemy.damage);
            this.cameras.main.flash(60, 255, 80, 0);
        }
    }

    // Minotaur: slow tank — walks toward player, stops to swing Attack1, plays hurt when hit
    aiMinotaur(enemy, time) {
        if (enemy.isAttacking || enemy.isHurt) return;

        const dx   = this.player.x - enemy.x;
        const dy   = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const attackRange = 55;

        enemy.setFlipX(dx < 0);

        if (dist > attackRange) {
            enemy.body.setVelocity((dx / dist) * enemy.currentSpeed, (dy / dist) * enemy.currentSpeed);
            if (enemy.anims.currentAnim?.key !== 'mino_move') enemy.play('mino_move', true);
        } else {
            enemy.body.setVelocity(0, 0);
            if (time - enemy.lastAttackTime >= enemy.attackCooldown) {
                enemy.lastAttackTime = time;
                enemy.isAttacking = true;
                enemy.play('mino_attack', true);
                // Deal damage at hit frame (~frame 4 of 8 at 12fps ≈ 300ms)
                this.time.delayedCall(300, () => {
                    if (!this.gameActive || !enemy.active || enemy.isDying) return;
                    const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    if (d <= attackRange + 15) {
                        this.damagePlayer(enemy.damage);
                        this.cameras.main.flash(100, 255, 50, 0);
                    }
                });
                enemy.once('animationcomplete', () => {
                    if (enemy.active && !enemy.isDying) {
                        enemy.isAttacking = false;
                        enemy.play('mino_idle');
                    }
                });
            } else if (enemy.anims.currentAnim?.key !== 'mino_idle') {
                enemy.play('mino_idle', true);
            }
        }
    }

    // ── Shared seek-and-attack pattern used by all 4 new enemies ────
    // moveAnim plays while approaching; idleAnim plays at attack range;
    // attackAnim plays on swing; damage fires at the hit frame (~400ms in).
    seekAndAttack(enemy, moveAnim, attackAnim, idleAnim, attackRange, time) {
        if (enemy.isAttacking || enemy.isHurt) return;
        const dx   = this.player.x - enemy.x;
        const dy   = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        enemy.setFlipX(dx < 0);

        if (dist > attackRange) {
            enemy.body.setVelocity((dx / dist) * enemy.currentSpeed, (dy / dist) * enemy.currentSpeed);
            if (enemy.anims.currentAnim?.key !== moveAnim) enemy.play(moveAnim, true);
        } else {
            enemy.body.setVelocity(0, 0);
            const cur = enemy.anims.currentAnim?.key;
            if (cur !== idleAnim && cur !== attackAnim) enemy.play(idleAnim, true);

            if (time - enemy.lastAttackTime >= enemy.attackCooldown) {
                enemy.lastAttackTime = time;
                enemy.isAttacking = true;
                enemy.play(attackAnim, true);
                // Damage fires at the hit frame — ~frame 4 of 8 at the animation's frameRate
                this.time.delayedCall(350, () => {
                    if (!this.gameActive || !enemy.active || enemy.isDying) return;
                    const d = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
                    if (d <= attackRange + 15) {
                        this.damagePlayer(enemy.damage);
                        this.cameras.main.flash(80, 255, 50, 0);
                    }
                });
                enemy.once('animationcomplete', () => {
                    if (enemy.active && !enemy.isDying) {
                        enemy.isAttacking = false;
                        enemy.play(idleAnim, true);
                    }
                });
            }
        }
    }

    aiFlyingEye(enemy, time) {
        this.seekAndAttack(enemy, 'eye_flight', 'eye_attack', 'eye_flight', 40, time);
    }

    aiGoblin(enemy, time) {
        this.seekAndAttack(enemy, 'gob_run', 'gob_attack', 'gob_idle', 40, time);
    }

    aiMushroom(enemy, time) {
        this.seekAndAttack(enemy, 'mush_run', 'mush_attack', 'mush_idle', 38, time);
    }

    aiSkeleton(enemy, time) {
        this.seekAndAttack(enemy, 'skel_walk', 'skel_attack', 'skel_shield', 44, time);
    }

    // Boss wolf: always seeks player, plays wolf_run while charging,
    // plays wolf_attack and bites when close (same as rusher but scaled up)
    aiBoss(boss, time) {
        const dx   = this.player.x - boss.x;
        const dy   = this.player.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = boss.hp < boss.maxHp * 0.5 ? 180 : 130;

        if (dist > 0) {
            boss.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
            boss.setFlipX(dx < 0);
        }
        if (dist <= 55 && time - (boss.lastMeleeTime || 0) >= 800) {
            boss.lastMeleeTime = time;
            this.damagePlayer(boss.damage);
            this.cameras.main.flash(100, 255, 50, 0);
        }
    }

    // ================================================================
    //  DEBUFF SYSTEM
    //
    //  Debuff types:
    //    slow       — 20% move speed reduce per stack; 5 stacks converts to freeze
    //    freeze     — full stop for duration
    //    bleed      — DOT, left by Death Pool puddles
    //    vulnerable — takes 15% more damage per stack (from Aura)
    //    fire       — burning DOT (TBD source — stub ready)
    //    TBD        — stub slot for future debuffs
    //
    //  Proliferate augment:
    //    adds +N bonus stacks when any debuff is applied (N = Proliferate level)
    //    extends debuff duration by up to +4 seconds at max level
    // ================================================================

    applyDebuff(enemy, type, stacks = 1) {
        if (!enemy.active) return;
        if (!enemy.debuffs) enemy.debuffs = {};

        const prolifLv    = this.augLevel('proliferate');
        const bonusStacks = prolifLv;                                   // +1 stack per Proliferate level
        const durationBonus = Math.min(4000, prolifLv * 1500);         // +1.5s per level, cap 4s

        const totalStacks = stacks + bonusStacks;
        const baseDuration = 2000;
        const finalDuration = baseDuration + durationBonus;

        switch (type) {
            case 'slow': {
                const prev      = enemy.debuffs.slow?.stacks || 0;
                const newStacks = Math.min(5, prev + totalStacks);
                enemy.debuffs.slow = { stacks: newStacks, expiry: this.time.now + finalDuration };
                // 5 slow stacks converts to a freeze
                if (newStacks >= 5) {
                    delete enemy.debuffs.slow;
                    this.applyDebuff(enemy, 'freeze', 1);
                }
                break;
            }
            case 'freeze':
                enemy.debuffs.freeze = { expiry: this.time.now + 1500 + durationBonus };
                enemy.setTint(0x88ccff); // blue tint while frozen
                break;

            case 'bleed': {
                const prev = enemy.debuffs.bleed?.stacks || 0;
                enemy.debuffs.bleed = {
                    stacks:   Math.min(5, prev + totalStacks),
                    lastTick: this.time.now,
                    expiry:   this.time.now + 3000 + durationBonus
                };
                break;
            }
            case 'vulnerable': {
                const prev = enemy.debuffs.vulnerable?.stacks || 0;
                enemy.debuffs.vulnerable = {
                    stacks: Math.min(5, prev + totalStacks),
                    expiry: this.time.now + finalDuration
                };
                break;
            }
            case 'fire': {
                // TBD source (future weapon/augment can call applyDebuff(enemy, 'fire'))
                const prev = enemy.debuffs.fire?.stacks || 0;
                enemy.debuffs.fire = {
                    stacks:   Math.min(3, prev + totalStacks),
                    lastTick: this.time.now,
                    expiry:   this.time.now + 3000 + durationBonus
                };
                enemy.setTint(0xff6600); // orange tint while burning
                break;
            }
            // TBD — add more debuff types here as needed
        }
    }

    // Ticks DOT debuffs and clears expired ones — called every frame
    updateDebuffs(time) {
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.debuffs) return;

            // Freeze — clear when expired and restore tint
            if (enemy.debuffs.freeze && time >= enemy.debuffs.freeze.expiry) {
                delete enemy.debuffs.freeze;
                enemy.clearTint();
            }

            // Slow — clear when expired
            if (enemy.debuffs.slow && time >= enemy.debuffs.slow.expiry) {
                delete enemy.debuffs.slow;
            }

            // Vulnerable — clear when expired
            if (enemy.debuffs.vulnerable && time >= enemy.debuffs.vulnerable.expiry) {
                delete enemy.debuffs.vulnerable;
            }

            // Bleed — tick DOT every 500ms
            if (enemy.debuffs.bleed) {
                if (time >= enemy.debuffs.bleed.expiry) {
                    delete enemy.debuffs.bleed;
                } else if (time - enemy.debuffs.bleed.lastTick >= 500) {
                    enemy.debuffs.bleed.lastTick = time;
                    this.applyDamageToEnemy(enemy, enemy.debuffs.bleed.stacks * 3, true);
                }
            }

            // Fire — tick DOT every 500ms
            if (enemy.debuffs.fire) {
                if (time >= enemy.debuffs.fire.expiry) {
                    delete enemy.debuffs.fire;
                    enemy.clearTint();
                } else if (time - enemy.debuffs.fire.lastTick >= 500) {
                    enemy.debuffs.fire.lastTick = time;
                    this.applyDamageToEnemy(enemy, enemy.debuffs.fire.stacks * 4, true);
                }
            }
        });
    }

    // ================================================================
    //  MUSIC NOTES AUGMENT
    // ================================================================

    triggerMusicBuff() {
        const lv = this.augLevel('musicNotes');
        const durations = [2000, 3500, 5000];
        const duration  = durations[lv - 1];

        // Kill-stack contribution for Lv3 — diminishing, then detrimental after ~5 kills
        let stackContrib = 0;
        if (lv >= 3) {
            for (let i = 0; i < this.musicKillStacks; i++) {
                stackContrib += Math.max(-1.5, 1 - i * 0.25);
            }
        }

        const newSpeed = 35 + Math.round(stackContrib * 12);
        const newDmg   = 8  + Math.round(stackContrib * 3);
        const cdMult   = 0.85;

        // Remove old buff before re-applying (timer refresh)
        if (this.musicBuff.active) {
            this.stats.moveSpeed      = Math.max(50, this.stats.moveSpeed - this.musicBuff.speedApplied);
            this.stats.damage         = Math.max(1,  this.stats.damage    - this.musicBuff.dmgApplied);
            this.stats.attackCooldown = Math.floor(this.stats.attackCooldown / this.musicBuff.cdApplied);
            if (this.musicBuffTimer) this.musicBuffTimer.remove();
        }

        // Apply buff
        this.stats.moveSpeed      += newSpeed;
        this.stats.damage         += newDmg;
        this.stats.attackCooldown  = Math.max(200, Math.floor(this.stats.attackCooldown * cdMult));
        this.musicBuff = { active: true, speedApplied: newSpeed, dmgApplied: newDmg, cdApplied: 1 / cdMult };

        this.showMusicNotes();

        this.musicBuffTimer = this.time.delayedCall(duration, () => {
            if (!this.gameActive) return;
            this.stats.moveSpeed      = Math.max(50, this.stats.moveSpeed - newSpeed);
            this.stats.damage         = Math.max(1,  this.stats.damage    - newDmg);
            this.stats.attackCooldown = Math.floor(this.stats.attackCooldown * (1 / cdMult));
            this.musicBuff = { active: false, speedApplied: 0, dmgApplied: 0, cdApplied: 1 };
            this.musicBuffTimer = null;
        });
    }

    showMusicNotes() {
        ['♪', '♫', '♪'].forEach((note, i) => {
            this.time.delayedCall(i * 130, () => {
                if (!this.gameActive) return;
                const t = this.add.text(
                    this.player.x + Phaser.Math.Between(-22, 22),
                    this.player.y - 20,
                    note,
                    { fontSize: '18px', color: '#ffee55', stroke: '#000000', strokeThickness: 2 }
                ).setDepth(20);
                this.tweens.add({ targets: t, y: t.y - 55, alpha: 0, duration: 750,
                    ease: 'Quad.easeOut', onComplete: () => t.destroy() });
            });
        });
    }

    // ================================================================
    //  AURA AUGMENT — three rotating rings around the player
    //  Enemies inside a ring take damage, get knocked back, and gain Vulnerable
    // ================================================================

    handleAura(dt) {
        if (!this.augLevel('aura') || !this.auraGraphics) return;

        this.auraAngle = (this.auraAngle + 100 * dt) % 360;

        const radii  = [65, 95, 125];
        const colors = [0x4488ff, 0x2255dd, 0x0033aa];
        const g      = this.auraGraphics;
        const auraDmg = this.augLevel('aura') * 5;

        g.clear();
        g.setPosition(this.player.x, this.player.y);
        radii.forEach((r, i) => {
            const start = Phaser.Math.DegToRad(this.auraAngle + i * 120);
            g.lineStyle(3, colors[i], 0.85);
            g.beginPath();
            g.arc(0, 0, r, start, start + Math.PI * 1.5);
            g.strokePath();
        });

        const now = this.time.now;
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            const inRing = radii.some(r => Math.abs(dist - r) < 15);
            if (inRing && (!enemy.lastAuraHit || now - enemy.lastAuraHit > 400)) {
                enemy.lastAuraHit = now;
                this.applyDamageToEnemy(enemy, auraDmg, true);
                this.applyDebuff(enemy, 'vulnerable', 1);
                // Knockback away from player
                const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                enemy.body.setVelocity(Math.cos(angle) * 220, Math.sin(angle) * 220);
            }
        });
    }

    // ================================================================
    //  SHIELD AUGMENT — block cap and recharge
    // ================================================================

    setupShield(level) {
        const maxCharges   = level;
        const rechargeTime = Math.max(8000, 20000 - level * 4000);

        // Fill up to new cap immediately when leveling
        this.shieldCharges = Math.min(maxCharges, this.shieldCharges + 1);

        // Start recharge loop if not already at cap
        if (!this.shieldRecharging && this.shieldCharges < maxCharges) {
            this.startShieldRecharge(maxCharges, rechargeTime);
        }
    }

    startShieldRecharge(maxCharges, rechargeTime) {
        const lvl = this.augLevel('shield');
        if (!lvl) return;
        const rt = Math.max(8000, 20000 - lvl * 4000);
        this.shieldRecharging = true;
        this.time.delayedCall(rt, () => {
            this.shieldCharges    = Math.min(this.augLevel('shield'), this.shieldCharges + 1);
            this.shieldRecharging = false;
            if (this.shieldCharges < this.augLevel('shield')) {
                this.startShieldRecharge(maxCharges, rt);
            }
        });
    }

    handleShieldVisual() {
        if (!this.augLevel('shield')) return;
        if (!this.shieldVisual) {
            this.shieldVisual = this.add.circle(0, 0, 28, 0x4488ff, 0)
                .setStrokeStyle(3, 0x88ccff, 0.9).setDepth(11);
        }
        this.shieldVisual.setPosition(this.player.x, this.player.y);
        this.shieldVisual.setVisible(this.shieldCharges > 0);
    }

    // ================================================================
    //  COLLISION CALLBACKS
    // ================================================================

    onEnemyTouchPlayer(player, enemy) {
        if (enemy.enemyType !== 'rusher' && enemy.enemyType !== 'boss') return;
        if (enemy.isDying) return;
        const now = this.time.now;
        if (!enemy.lastMeleeTime || now - enemy.lastMeleeTime > 600) {
            enemy.lastMeleeTime = now;
            this.damagePlayer(enemy.damage);
        }
    }

    onPoolHitEnemy(pool, enemy) {
        const now = this.time.now;
        if (!enemy.poolTimes) enemy.poolTimes = {};
        const key = `p${pool.poolId}`;
        if (!enemy.poolTimes[key] || now - enemy.poolTimes[key] > 500) {
            enemy.poolTimes[key] = now;
            this.applyDamageToEnemy(enemy, pool.poolDmg || 5);
            this.applyDebuff(enemy, 'bleed', 1); // death pools apply bleed
        }
    }

    // ================================================================
    //  DAMAGE HELPERS
    // ================================================================

    // silent = true suppresses the hit sound (used for DOT ticks)
    applyDamageToEnemy(enemy, damage, silent = false) {
        if (!enemy.active || enemy.isDying) return;

        // Vulnerable debuff — each stack adds 15% more damage taken
        let finalDmg = damage;
        if (enemy.debuffs?.vulnerable?.stacks) {
            finalDmg *= (1 + enemy.debuffs.vulnerable.stacks * 0.15);
        }

        enemy.hp -= finalDmg;
        if (!silent) {
            this.playSound('hit', { volume: 0.3 });
            // Animated enemies play their hit reaction; others just flash white
            const hitMap = {
                minotaur: ['mino_hurt',  'mino_idle'   ],
                eye:      ['eye_hit',    'eye_flight'  ],
                goblin:   ['gob_hit',    'gob_idle'    ],
                mushroom: ['mush_hit',   'mush_idle'   ],
                skeleton: ['skel_hit',   'skel_shield' ],
            };
            const hitInfo = hitMap[enemy.enemyType];
            if (hitInfo && !enemy.isHurt && !enemy.isDying) {
                enemy.isAttacking = false;
                enemy.isHurt = true;
                enemy.body.setVelocity(0, 0);
                enemy.play(hitInfo[0], true);
                enemy.once('animationcomplete', () => {
                    if (enemy.active && !enemy.isDying) { enemy.isHurt = false; enemy.play(hitInfo[1]); }
                });
            } else {
                enemy.setTint(0xffffff);
                this.time.delayedCall(80, () => { if (enemy.active && !enemy.isDying) enemy.clearTint(); });
                this.tweens.add({ targets: enemy, alpha: 0.3, duration: 80, yoyo: true });
            }
        }

        if (enemy.hp <= 0) this.enemyDied(enemy);
    }

    enemyDied(enemy) {
        if (!enemy.active || enemy.isDying) return;
        this.dropXpOrb(enemy.x, enemy.y, enemy.xpValue);
        if (this.augLevel('deathPool')) this.createDeathPool(enemy.x, enemy.y);

        // Fire Attack Lv3 — spread fire to nearest alive enemy
        if (this.augLevel('fireAttack') >= 3 && enemy.debuffs?.fire) {
            const nearest = this.findNearestEnemy(enemy.x, enemy.y, [enemy]);
            if (nearest) {
                if (!nearest.debuffs) nearest.debuffs = {};
                nearest.debuffs.fire = {
                    stacks:   enemy.debuffs.fire.stacks,
                    lastTick: this.time.now,
                    expiry:   this.time.now + 4000
                };
                nearest.setTint(0xff6600);
            }
        }

        // Music Notes Lv3 — accumulate kill stacks (used for buff bonus/penalty)
        if (this.augLevel('musicNotes') >= 3) {
            this.musicKillStacks++;
        }

        // OmniVamp Lv3 — steal a sliver of enemy stats (capped at 5 stacks)
        if (this.augLevel('omnivamp') >= 3 && this.omnivampStacks < 5) {
            this.omnivampStacks++;
            this.stats.hpRegen += 0.5;  // stolen regen per stack
            // stolen lifesteal tracked via omnivampStacks (+1% per stack in doMeleeHit)
        }

        if (enemy.enemyType === 'boss') {
            this.bossAlive = false;
            this.playSound('boss_death', { volume: 0.8 });
            enemy.destroy();
            this.triggerWin();
            return;
        }

        // Animated enemies play a death animation before being removed
        const deathMap = {
            minotaur: 'mino_death',
            eye:      'eye_death',
            goblin:   'gob_death',
            mushroom: 'mush_death',
            skeleton: 'skel_death',
        };
        const deathAnim = deathMap[enemy.enemyType];
        if (deathAnim) {
            enemy.isDying = true;
            if (enemy.isAttacking !== undefined) { enemy.isAttacking = false; enemy.isHurt = false; }
            enemy.body.setVelocity(0, 0);
            enemy.play(deathAnim, true);
            this.playSound('enemy_death', { volume: 0.35 });
            enemy.once('animationcomplete', () => { if (enemy.active) enemy.destroy(); });
            return;
        }

        this.playSound('enemy_death', { volume: 0.25 });
        enemy.destroy();
    }

    damagePlayer(amount) {
        if (!this.gameActive) return;

        // Shield absorbs the hit — play block animation, then recharge
        if (this.shieldCharges > 0) {
            this.shieldCharges--;
            this.cameras.main.flash(80, 0, 100, 255);
            if (!this.isDead) {
                this.isHurt = true;
                this.player.play('player_block', true);
                this.player.once('animationcomplete', () => { this.isHurt = false; });
            }
            if (!this.shieldRecharging) this.startShieldRecharge();
            return;
        }

        this.stats.hp -= amount;
        this.cameras.main.flash(120, 255, 0, 0);
        this.playSound('player_hurt', { volume: 0.6 });

        if (!this.isDead) {
            this.isHurt      = true;
            this.isAttacking = false;
            this.player.play('player_hurt', true);
            this.player.once('animationcomplete', () => { this.isHurt = false; });
        }

        if (this.stats.hp <= 0) { this.stats.hp = 0; this.triggerDeath(); }
    }

    // ================================================================
    //  XP ORBS
    // ================================================================

    dropXpOrb(x, y, value) {
        const orb = this.xpOrbs.create(x, y, 'xp_orb');
        if (!orb) return;
        orb.xpValue = value; orb.setDepth(4);
        orb.body.setVelocity(Phaser.Math.Between(-40, 40), Phaser.Math.Between(-40, 40));
        this.time.delayedCall(300, () => { if (orb.active) orb.body.setVelocity(0, 0); });
    }

    // ================================================================
    //  DEATH POOL AUGMENT
    // ================================================================

    createDeathPool(x, y) {
        const pool = this.deathPoolGroup.create(x, y, 'death_pool');
        if (!pool) return;
        const lv = this.augLevel('deathPool');
        pool.setAlpha(0.5).setDepth(3);
        pool.poolId  = this.poolCounter++;
        pool.poolDmg = 5 + lv * 3; // damage scales with Death Pool level
        this.time.delayedCall(3000, () => { if (pool.active) pool.destroy(); });
        this.tweens.add({ targets: pool, alpha: 0, duration: 3000 });
    }

    // ================================================================
    //  XP / LEVEL UP
    // ================================================================

    collectXp(amount) {
        this.xp += amount;
        if (this.xp >= this.xpRequired) this.levelUp();
    }

    levelUp() {
        this.level++;
        this.xp         -= this.xpRequired;
        this.xpRequired  = Math.floor(50 + 40 * (this.level - 1) * Math.pow(1.1, this.level - 1));

        const choices = this.getRandomUpgrades(3);
        this.game.registry.set('pendingUpgrades', choices);
        this.game.registry.set('currentLevel', this.level);

        this.playSound('level_up', { volume: 0.7 });
        this.scene.pause('gameScene');
        this.scene.launch('levelUpScene');
    }

    onResume() {
        const chosen = this.game.registry.get('chosenUpgrade');
        if (chosen) { this.applyUpgrade(chosen); this.game.registry.remove('chosenUpgrade'); }
    }

    // ================================================================
    //  UPGRADE POOL — defines all upgrades with level caps
    // ================================================================

    getAllUpgrades() {
        return [
            // ── Stat Upgrades ──────────────────────────────────────────
            { id: 'damage',      type: 'stat',    name: 'Damage',       icon: '⚔',  maxLevel: 10, desc: lv => `+5 flat damage  [Lv.${lv}]` },
            { id: 'attackSpeed', type: 'stat',    name: 'Attack Speed', icon: '⚡',  maxLevel: 8,  desc: lv => `+15% attack rate  [Lv.${lv}]` },
            { id: 'moveSpeed',   type: 'stat',    name: 'Move Speed',   icon: '👟', maxLevel: 8,  desc: lv => `+20 move speed  [Lv.${lv}]` },
            { id: 'hpRegen',     type: 'stat',    name: 'HP Regen',     icon: '💚', maxLevel: 8,  desc: lv => `+0.5 HP/sec  [Lv.${lv}]` },
            { id: 'pickupRange', type: 'stat',    name: 'Pickup Range', icon: '🧲', maxLevel: 5,  desc: lv => `+30 XP pickup radius  [Lv.${lv}]` },
            { id: 'maxHealth',   type: 'stat',    name: 'Max Health',   icon: '❤',  maxLevel: 6,  desc: lv => `+20 max HP  [Lv.${lv}]` },
            { id: 'extraShot',   type: 'stat',    name: 'Extra Shot',   icon: '✦',  maxLevel: 3,  desc: lv => `+1 extra projectile/attack  [Lv.${lv}]` },
            { id: 'cooldown',    type: 'stat',    name: 'Cooldown',     icon: '⏱',  maxLevel: 5,  desc: lv => `-10% all cooldowns  [Lv.${lv}]` },

            // ── Augments ───────────────────────────────────────────────
            { id: 'overkill',     type: 'augment', name: 'Overkill',      icon: '💥', maxLevel: 4, desc: lv => `Excess dmg splashes ${80+lv*20}px radius` },
            { id: 'doubleStrike', type: 'augment', name: 'Double Strike', icon: '⚔⚔', maxLevel: 4, desc: lv => `Follow-up strike at ${30+lv*10}% dmg${lv>=4?' + knockback':''}` },
            { id: 'musicNotes',   type: 'augment', name: 'Music Notes',   icon: '🎵', maxLevel: 3, desc: lv => `Attack buffs speed/dmg/atkspd for ${[2,3.5,5][lv-1]}s${lv>=3?'. Kills stack (diminishing)':''}` },
            { id: 'fireAttack',   type: 'augment', name: 'Fire Attack',   icon: '🔥', maxLevel: 3, desc: lv => `Attacks ignite: ${[2,3,3][lv-1]} stacks, ${[3,4.5,5][lv-1]}s${lv>=3?' + spreads on kill':''}` },
            { id: 'omnivamp',     type: 'augment', name: 'Omni-Vamp',     icon: '🩸', maxLevel: 3, desc: lv => `Heal ${[3,7,12][lv-1]}% of dmg dealt${lv>=3?'. Kills steal enemy stats (5× max)':''}` },
            { id: 'deathPool',    type: 'augment', name: 'Death Pool',    icon: '☠',  maxLevel: 4, desc: lv => `Bleed puddles deal ${5+lv*3} DPS` },
            { id: 'freeze',       type: 'augment', name: 'Freeze',        icon: '❄',  maxLevel: 3, desc: lv => `Slow 20% per stack (+${lv} stacks), x5=freeze` },
            { id: 'chain',        type: 'augment', name: 'Chain',         icon: '🔗', maxLevel: 3, desc: lv => `Attacks chain to ${lv} extra enem${lv>1?'ies':'y'}` },
            { id: 'proliferate',  type: 'augment', name: 'Proliferate',   icon: '🌀', maxLevel: 4, desc: lv => `+${lv} debuff stacks, +${(Math.min(4,lv*1.5)).toFixed(1)}s duration` },
            { id: 'aura',         type: 'augment', name: 'Aura',          icon: '🔵', maxLevel: 3, desc: lv => `Rotating rings: ${lv*5} dmg, knockback, Vulnerable` },
            { id: 'lucky',        type: 'augment', name: 'Lucky',         icon: '🍀', maxLevel: 3, desc: lv => `+${lv*5}% crit chance, better upgrade pool` },
            { id: 'shield',       type: 'augment', name: 'Shield',        icon: '🛡',  maxLevel: 3, desc: lv => `${lv} block${lv>1?'s':''}, ${Math.max(8,20-lv*4)}s recharge` },
            { id: 'cloak',        type: 'augment', name: 'Cloak',         icon: '🎯', maxLevel: 5, desc: lv => `+${lv*19}% crit chance${lv>=5?', +20% crit dmg':''}` },
            { id: 'bombs',        type: 'augment', name: 'Bombs',         icon: '💣', maxLevel: 3, desc: lv => `Throw 2 bombs every ${[8,6,4][lv-1]}s, ${[25,40,60][lv-1]}dmg${lv>=3?' + burn ground, extra hp-% bomb, DoTs, crits':''}` },
        ];
    }

    // Returns 3 random upgrades, respecting max levels and Lucky weighting
    getRandomUpgrades(count) {
        const all       = this.getAllUpgrades();
        const available = all.filter(u => (this.upgradeLevels[u.id] || 0) < u.maxLevel);

        // Lucky augment biases the pool toward augments
        const luckLv = this.augLevel('lucky');
        let pool     = [...available];
        if (luckLv > 0) {
            const augments = available.filter(u => u.type === 'augment');
            for (let i = 0; i < luckLv * 2; i++) pool = pool.concat(augments);
        }

        const shuffled = Phaser.Utils.Array.Shuffle([...pool]);
        const seen = new Set(), picks = [];
        for (const u of shuffled) {
            if (seen.has(u.id)) continue;
            seen.add(u.id);
            const curLv = this.upgradeLevels[u.id] || 0;
            picks.push({ ...u, currentLevel: curLv, nextLevel: curLv + 1, desc: u.desc(curLv + 1) });
            if (picks.length >= count) break;
        }
        return picks;
    }

    // Applies the chosen upgrade — increments level then activates the effect
    applyUpgrade(upgrade) {
        const prevLevel = this.upgradeLevels[upgrade.id] || 0;
        const newLevel  = prevLevel + 1;
        this.upgradeLevels[upgrade.id] = newLevel;

        if (upgrade.type === 'stat') {
            switch (upgrade.id) {
                case 'damage':
                    this.stats.damage += 5;
                    break;
                case 'attackSpeed':
                    this.stats.attackCooldown = Math.max(250, Math.floor(this.stats.attackCooldown * 0.85));
                    break;
                case 'moveSpeed':
                    this.stats.moveSpeed += 20;
                    break;
                case 'hpRegen':
                    this.stats.hpRegen += 0.5;
                    break;
                case 'pickupRange':
                    this.stats.pickupRange += 30;
                    break;
                case 'maxHealth':
                    this.stats.maxHp += 20;
                    this.stats.hp     = Math.min(this.stats.maxHp, this.stats.hp + 20);
                    break;
                case 'extraShot':
                    this.stats.extraShots += 1;
                    break;
                case 'cooldown':
                    // Reduces all cooldowns by 10% per level
                    this.stats.cooldownMult    *= 0.90;
                    this.stats.attackCooldown   = Math.max(200, Math.floor(this.stats.attackCooldown * 0.90));
                    if (this.wandTimer) this.setupWand(this.augLevel('wand'));
                    break;
            }
        } else {
            // Augments — activate or level up their systems
            switch (upgrade.id) {
                case 'aura':
                    if (newLevel === 1) {
                        this.auraGraphics = this.add.graphics().setDepth(9);
                        this.auraAngle    = 0;
                    }
                    break;
                case 'shield':
                    this.setupShield(newLevel);
                    break;
                case 'bombs':
                    this.setupBombTimer(newLevel);
                    break;
                case 'lucky':
                    this.stats.critChance = Math.min(0.95, this.stats.critChance + 0.05);
                    break;
                case 'cloak':
                    this.stats.critChance = Math.min(0.95, this.stats.critChance + 0.19);
                    if (newLevel >= 5) this.stats.critDamage += 0.20;
                    break;
                // freeze, chain, overkill, ricochet, deathPool, proliferate
                // all take effect automatically through the combat callbacks — no extra setup needed
            }
        }

        this.updateAugmentDisplay();
    }

    // Updates the top-left augment icon strip with current levels
    updateAugmentDisplay() {
        const icons = {
            overkill:'💥', doubleStrike:'⚔⚔', musicNotes:'🎵', fireAttack:'🔥', omnivamp:'🩸', bombs:'💣',
            deathPool:'☠', freeze:'❄', chain:'🔗', proliferate:'🌀',
            aura:'🔵', lucky:'🍀', shield:'🛡', cloak:'🎯'
        };
        const parts = this.getAllUpgrades()
            .filter(u => u.type === 'augment' && (this.upgradeLevels[u.id] || 0) > 0)
            .map(u => {
                const lv = this.upgradeLevels[u.id];
                return icons[u.id] + (lv > 1 ? lv : '');
            });
        this.augmentText.setText(parts.join('  '));
    }

    // Convenience: returns the current level of an upgrade (0 if not picked)
    augLevel(id) { return this.upgradeLevels[id] || 0; }

    // ================================================================
    //  WIN / DEATH
    // ================================================================

    triggerWin() {
        this.gameActive = false;
        this.physics.world.pause();
        this.stopMusic();

        const save       = this.getSave() || {};
        save.completedRun = true;
        if (this.gameTime < (save.bestTime || Infinity)) save.bestTime = Math.floor(this.gameTime);
        this.setSave(save);

        this.time.delayedCall(800, () => this.scene.start('winScene', { survivalTime: this.gameTime }));
    }

    triggerDeath() {
        if (!this.gameActive) return;
        this.gameActive = false;
        this.isDead     = true;
        this.physics.world.pause();
        this.stopMusic();

        this.isHurt      = false;
        this.isAttacking = false;
        this.player.play('player_death', true);
        this.player.once('animationcomplete', () => {
            this.time.delayedCall(600, () => this.scene.start('deathScene', { survivalTime: this.gameTime, level: this.level }));
        });
    }

    getSave()       { try { return JSON.parse(localStorage.getItem('survivorData')); } catch(e) { return null; } }
    setSave(data)   { localStorage.setItem('survivorData', JSON.stringify(data)); }

    // ================================================================
    //  DEBUG — press B to skip to the boss fight for testing
    // ================================================================

    setupDebug() {
        this.input.keyboard.once('keydown-B', () => { this.gameTime = 899; });
    }
}
