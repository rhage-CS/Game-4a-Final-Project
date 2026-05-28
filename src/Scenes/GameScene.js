// GameScene.js — Main gameplay scene.
// All systems live here: movement, auto-attack, enemies, debuffs, augments, XP, boss, win/death.

class GameScene extends Phaser.Scene {
    constructor() {
        super('gameScene');
    }

    init(data) {
        this.classId = data.classId || 1;
    }

    // ================================================================
    //  CREATE
    // ================================================================

    create() {
        this.WORLD_W    = 3000;
        this.WORLD_H    = 3000;
        this.wallsLayer = null;

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
        this.setupGroups();
        this.setupCollisions();
        this.setupTimers();
        this.setupHUD();
        this.setupCamera();
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
        if (this.classId === 1) {
            this.stats = {
                maxHp: 100, hp: 100,
                hpRegen: 1,
                moveSpeed: 200,
                damage: 10,
                attackCooldown: 1000,
                pickupRange: 80,
                critChance: 0.10,   // base 10%
                critDamage: 1.5,    // base 1.5× on crit
                luck: 0,            // affects upgrade card pool quality
                extraShots: 0,      // extra projectiles per attack
                cooldownMult: 1.0   // multiplier applied to all cooldowns
            };
        } else {
            this.stats = {
                maxHp: 80, hp: 80,
                hpRegen: 0.5,
                moveSpeed: 170,
                damage: 7,
                attackCooldown: 1500,
                pickupRange: 110,
                critChance: 0.10,
                critDamage: 1.5,
                luck: 0,
                extraShots: 0,
                cooldownMult: 1.0
            };
        }
        this.lastAttackTime   = 0;
        this.regenAccumulator = 0;
        this.shieldCharges    = 0;    // current available blocks (Shield augment)
        this.shieldRecharging = false;
        this.auraAngle        = 0;    // rotation state for Aura rings
        this.auraGraphics     = null;
        this.shieldVisual     = null;
        this.wandTimer        = null;
    }

    // ================================================================
    //  TILEMAP — see comments in setupTilemap for Tiled layer names
    // ================================================================

    setupTilemap() {
        const hasMap = this.cache.tilemap.has('map');
        if (!hasMap) {
            this.add.tileSprite(0, 0, this.WORLD_W, this.WORLD_H, 'bg_tile').setOrigin(0, 0);
            return;
        }
        this.map     = this.make.tilemap({ key: 'map' });
        this.WORLD_W = this.map.widthInPixels;
        this.WORLD_H = this.map.heightInPixels;
        const tileset = this.map.addTilesetImage('tileset', 'tileset');

        if (this.map.getLayer('Ground'))     this.map.createLayer('Ground',     tileset, 0, 0).setDepth(0);
        if (this.map.getLayer('Decoration')) this.map.createLayer('Decoration', tileset, 0, 0).setDepth(1);
        if (this.map.getLayer('Walls')) {
            this.wallsLayer = this.map.createLayer('Walls', tileset, 0, 0).setDepth(2);
            this.wallsLayer.setCollisionByProperty({ collides: true });
        }
        if (this.map.getLayer('Above'))      this.map.createLayer('Above',      tileset, 0, 0).setDepth(20);
        if (this.map.getObjectLayer('Objects')) this.readTiledObjects();
    }

    readTiledObjects() {
        this.map.getObjectLayer('Objects').objects.forEach(obj => {
            const cx = obj.x + (obj.width  || 0) / 2;
            const cy = obj.gid ? obj.y - (obj.height || 0) / 2 : obj.y + (obj.height || 0) / 2;
            if (obj.name === 'spawn') this._tiledSpawn = { x: cx, y: cy };
            if (obj.name === 'item')  { /* wire up item pickups here */ }
        });
    }

    // ================================================================
    //  PLAYER
    // ================================================================

    createPlayer() {
        const textureKey = this.classId === 1 ? 'player1' : 'player2';
        const spawnX     = this._tiledSpawn ? this._tiledSpawn.x : this.WORLD_W / 2;
        const spawnY     = this._tiledSpawn ? this._tiledSpawn.y : this.WORLD_H / 2;
        this.player = this.physics.add.sprite(spawnX, spawnY, textureKey);
        this.player.setCollideWorldBounds(true).setDepth(10);
    }

    // ================================================================
    //  GROUPS
    // ================================================================

    setupGroups() {
        this.enemies           = this.physics.add.group();
        this.playerProjectiles = this.physics.add.group();
        this.enemyProjectiles  = this.physics.add.group();
        this.xpOrbs            = this.physics.add.group();
        this.deathPoolGroup    = this.physics.add.staticGroup();
    }

    // ================================================================
    //  COLLISIONS
    // ================================================================

    setupCollisions() {
        this.physics.add.overlap(this.playerProjectiles, this.enemies,       this.onProjectileHitEnemy,       null, this);
        this.physics.add.overlap(this.player,            this.enemyProjectiles, this.onEnemyProjectileHitPlayer, null, this);
        this.physics.add.overlap(this.player,            this.enemies,       this.onEnemyTouchPlayer,         null, this);
        this.physics.add.overlap(this.deathPoolGroup,    this.enemies,       this.onPoolHitEnemy,             null, this);
        if (this.wallsLayer) {
            this.physics.add.collider(this.player,  this.wallsLayer);
            this.physics.add.collider(this.enemies, this.wallsLayer);
        }
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
        const W = this.scale.width;
        const H = this.scale.height;

        this.timerText   = this.add.text(W / 2, 16, '0:00 / 15:00', { fontSize: '20px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
        this.levelText   = this.add.text(W - 16, 16, 'Lv. 1',        { fontSize: '18px', color: '#ffcc44', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        this.augmentText = this.add.text(16, 16, '',                  { fontSize: '15px', color: '#aaffaa', stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0).setScrollFactor(0).setDepth(100);

        // HP bar
        this.add.rectangle(W / 2, H - 30, 400, 14, 0x330000).setScrollFactor(0).setDepth(100).setOrigin(0.5);
        this.hpBarFill = this.add.rectangle(W / 2 - 200, H - 30, 400, 14, 0x22cc44).setScrollFactor(0).setDepth(101).setOrigin(0, 0.5);
        this.hpText    = this.add.text(W / 2, H - 30, '', { fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

        // XP bar
        this.add.rectangle(W / 2, H - 12, 400, 10, 0x112200).setScrollFactor(0).setDepth(100).setOrigin(0.5);
        this.xpBarFill = this.add.rectangle(W / 2 - 200, H - 12, 0, 10, 0x44ff88).setScrollFactor(0).setDepth(101).setOrigin(0, 0.5);

        // Boss HP bar (hidden until boss spawns)
        this.bossBarBg   = this.add.rectangle(W / 2, 60, 500, 18, 0x330000).setScrollFactor(0).setDepth(100).setOrigin(0.5).setVisible(false);
        this.bossBarFill = this.add.rectangle(W / 2 - 250, 60, 500, 18, 0xff4400).setScrollFactor(0).setDepth(101).setOrigin(0, 0.5).setVisible(false);
        this.bossLabel   = this.add.text(W / 2, 60, 'BOSS', { fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(102).setVisible(false);

        // Shield charge display (top right, below level text)
        this.shieldHudText = this.add.text(W - 16, 40, '', { fontSize: '14px', color: '#88ccff', stroke: '#000000', strokeThickness: 3 }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

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
        const cam = this.cameras.main;
        cam.setBounds(0, 0, this.WORLD_W, this.WORLD_H);
        cam.startFollow(this.player, false, 0.1, 0.1);
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
    }

    // ================================================================
    //  AUTO-ATTACK
    // ================================================================

    handleAutoAttack(time) {
        if (time - this.lastAttackTime < this.stats.attackCooldown) return;
        if (this.classId === 1) this.fireTargetedShot();
        else                    this.fireNovaBurst();
        this.lastAttackTime = time;
    }

    // Ranger: fires 1 + extraShots projectiles at the closest enemies
    fireTargetedShot() {
        const count   = 1 + this.stats.extraShots;
        const targets = this.getClosestEnemies(count);
        if (!targets.length) return;
        targets.forEach(target => {
            const proj = this.playerProjectiles.create(this.player.x, this.player.y, 'projectile');
            if (!proj) return;
            proj.setDepth(5);
            this.physics.moveTo(proj, target.x, target.y, 500);
            this.time.delayedCall(2500, () => { if (proj.active) proj.destroy(); });
        });
        this.playSound('shoot', { volume: 0.4 });
    }

    // Nova: fires 8 + (extraShots×4) projectiles in a full circle
    fireNovaBurst() {
        const count = 8 + this.stats.extraShots * 4;
        for (let i = 0; i < count; i++) {
            const angle = Phaser.Math.DegToRad((360 / count) * i);
            const proj  = this.playerProjectiles.create(this.player.x, this.player.y, 'projectile');
            if (!proj) continue;
            proj.setTint(0xcc66ff).setDepth(5);
            proj.body.setVelocity(Math.cos(angle) * 420, Math.sin(angle) * 420);
            this.time.delayedCall(2200, () => { if (proj.active) proj.destroy(); });
        }
        this.playSound('shoot', { volume: 0.5 });
    }

    // Returns up to n closest enemies, sorted by distance
    getClosestEnemies(n) {
        return this.enemies.getChildren()
            .map(e => ({ e, d: Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y) }))
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
        if      (diff < 1) type = r < 0.7 ? 'rusher' : r < 0.9 ? 'shooter' : 'arcer';
        else if (diff < 2) type = r < 0.4 ? 'rusher' : r < 0.75 ? 'shooter' : 'arcer';
        else               type = r < 0.3 ? 'rusher' : r < 0.65 ? 'shooter' : 'arcer';

        if      (type === 'rusher')  this.createRusher(pos.x, pos.y, diff);
        else if (type === 'shooter') this.createShooter(pos.x, pos.y, diff);
        else                         this.createArcer(pos.x, pos.y, diff);
    }

    getSpawnPosition() {
        const cam = this.cameras.main, m = 60;
        const l = Math.max(0, cam.scrollX - m), t = Math.max(0, cam.scrollY - m);
        const r = Math.min(this.WORLD_W, cam.scrollX + cam.width + m);
        const b = Math.min(this.WORLD_H, cam.scrollY + cam.height + m);
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
        e.setDepth(8);
        e.enemyType = 'rusher'; e.maxHp = 20 + diff * 15; e.hp = e.maxHp;
        e.moveSpeed = 110 + diff * 30; e.damage = 10 + diff * 5; e.xpValue = 8;
        e.lastMeleeTime = 0; e.debuffs = {};
        if (diff > 2) e.setTint(0xff8844); else if (diff > 1) e.setTint(0xff4444);
        return e;
    }

    createShooter(x, y, diff) {
        const e = this.enemies.create(x, y, 'enemy_shooter');
        e.setDepth(8);
        e.enemyType = 'shooter'; e.maxHp = 25 + diff * 12; e.hp = e.maxHp;
        e.moveSpeed = 70 + diff * 20; e.damage = 8 + diff * 3; e.xpValue = 12;
        e.shootCooldown = Math.max(800, 2000 - diff * 300); e.lastShootTime = 0; e.debuffs = {};
        if (diff > 2) e.setTint(0x4499ff); else if (diff > 1) e.setTint(0x2266dd);
        return e;
    }

    createArcer(x, y, diff) {
        const e = this.enemies.create(x, y, 'enemy_arcer');
        e.setDepth(8);
        e.enemyType = 'arcer'; e.maxHp = 30 + diff * 14; e.hp = e.maxHp;
        e.moveSpeed = 65 + diff * 18; e.damage = 6 + diff * 2; e.xpValue = 15;
        e.shootCooldown = Math.max(1000, 2500 - diff * 400); e.lastShootTime = 0; e.debuffs = {};
        if (diff > 2) e.setTint(0x66ff88); else if (diff > 1) e.setTint(0x33aa55);
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
        boss.setDepth(9);
        boss.enemyType = 'boss'; boss.maxHp = 1000; boss.hp = 1000;
        boss.moveSpeed = 120; boss.damage = 20; boss.xpValue = 500;
        boss.phaseTimer = 0; boss.isCharging = true; boss.hasFiredPhase = false;
        boss.debuffs = {};

        this.bossRef = boss; this.bossAlive = true;
        this.bossBarBg.setVisible(true); this.bossBarFill.setVisible(true); this.bossLabel.setVisible(true);
        this.startMusic('boss_music');
        this.cameras.main.flash(500, 255, 100, 0);
        this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, '⚠ BOSS APPEARED ⚠',
            { fontSize: '36px', color: '#ff4400', stroke: '#000', strokeThickness: 5 }
        ).setScrollFactor(0).setDepth(200).setOrigin(0.5);
    }

    // ================================================================
    //  ENEMY AI
    // ================================================================

    handleEnemyAI(time) {
        this.enemies.getChildren().forEach(enemy => {
            // Frozen enemies can't move
            if (enemy.debuffs.freeze) {
                enemy.body.setVelocity(0, 0);
                return;
            }

            // Slow reduces movement speed (20% per stack, cap at 5 stacks = freeze)
            const slowStacks = enemy.debuffs.slow?.stacks || 0;
            enemy.currentSpeed = enemy.moveSpeed * Math.max(0.0, 1 - slowStacks * 0.2);

            switch (enemy.enemyType) {
                case 'rusher':  this.aiRusher(enemy);        break;
                case 'shooter': this.aiShooter(enemy, time); break;
                case 'arcer':   this.aiArcer(enemy, time);   break;
                case 'boss':    this.aiBoss(enemy, time);    break;
            }
        });
    }

    aiRusher(enemy) {
        this.physics.moveTo(enemy, this.player.x, this.player.y, enemy.currentSpeed);
    }

    aiShooter(enemy, time) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        if      (dist > 250) this.physics.moveTo(enemy, this.player.x, this.player.y, enemy.currentSpeed);
        else if (dist < 190) {
            const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            enemy.body.setVelocity(Math.cos(a) * enemy.currentSpeed * 0.6, Math.sin(a) * enemy.currentSpeed * 0.6);
        } else {
            enemy.body.setVelocity(0, 0);
        }
        if (time - enemy.lastShootTime >= enemy.shootCooldown) {
            enemy.lastShootTime = time;
            this.fireEnemyProjectile(enemy.x, enemy.y, this.player.x, this.player.y, enemy.damage);
        }
    }

    aiArcer(enemy, time) {
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        if      (dist > 270) this.physics.moveTo(enemy, this.player.x, this.player.y, enemy.currentSpeed);
        else if (dist < 210) {
            const a = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            enemy.body.setVelocity(Math.cos(a) * enemy.currentSpeed * 0.6, Math.sin(a) * enemy.currentSpeed * 0.6);
        } else {
            enemy.body.setVelocity(0, 0);
        }
        if (time - enemy.lastShootTime >= enemy.shootCooldown) {
            enemy.lastShootTime = time;
            this.fireEnemyArc(enemy.x, enemy.y, this.player.x, this.player.y, enemy.damage);
        }
    }

    aiBoss(boss, time) {
        const phase2 = boss.hp < boss.maxHp * 0.5;
        if (time >= boss.phaseTimer) {
            boss.isCharging = !boss.isCharging;
            boss.phaseTimer = time + (boss.isCharging ? (phase2 ? 1200 : 2000) : (phase2 ? 800 : 1500));
            boss.hasFiredPhase = false;
        }
        if (boss.isCharging) {
            this.physics.moveTo(boss, this.player.x, this.player.y, phase2 ? 180 : 130);
        } else {
            boss.body.setVelocity(0, 0);
            if (!boss.hasFiredPhase) {
                boss.hasFiredPhase = true;
                const n = phase2 ? 12 : 8;
                for (let i = 0; i < n; i++) {
                    const a    = Phaser.Math.DegToRad((360 / n) * i);
                    const proj = this.enemyProjectiles.create(boss.x, boss.y, 'enemy_proj');
                    if (!proj) continue;
                    proj.setTint(0xff6600).setScale(1.4).setDepth(5);
                    proj.body.setVelocity(Math.cos(a) * 280, Math.sin(a) * 280);
                    proj.damage = boss.damage;
                    this.time.delayedCall(3500, () => { if (proj.active) proj.destroy(); });
                }
            }
        }
    }

    fireEnemyProjectile(fx, fy, tx, ty, damage) {
        const proj = this.enemyProjectiles.create(fx, fy, 'enemy_proj');
        if (!proj) return;
        proj.setDepth(5); proj.damage = damage;
        this.physics.moveTo(proj, tx, ty, 260);
        this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
    }

    fireEnemyArc(fx, fy, tx, ty, damage) {
        const base = Phaser.Math.Angle.Between(fx, fy, tx, ty);
        [-0.4, 0, 0.4].forEach(offset => {
            const proj = this.enemyProjectiles.create(fx, fy, 'enemy_proj');
            if (!proj) return;
            proj.setDepth(5).setTint(0x66ff88); proj.damage = damage;
            const a = base + offset;
            proj.body.setVelocity(Math.cos(a) * 240, Math.sin(a) * 240);
            this.time.delayedCall(3000, () => { if (proj.active) proj.destroy(); });
        });
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
    //  WAND AUGMENT — separate auto-fire weapon
    // ================================================================

    setupWand(level) {
        if (this.wandTimer) this.wandTimer.remove();
        const cd = Math.max(400, 1500 - level * 200);
        this.wandTimer = this.time.addEvent({
            delay: cd, callback: this.fireWand, callbackScope: this, loop: true
        });
    }

    fireWand() {
        const lv = this.augLevel('wand');
        if (!lv || !this.gameActive) return;
        const projCount = lv >= 4 ? 2 : 1;
        const dmg       = 8 + lv * 5;
        const targets   = this.getClosestEnemies(projCount);
        targets.forEach(target => {
            const proj = this.playerProjectiles.create(this.player.x, this.player.y, 'projectile');
            if (!proj) return;
            proj.setTint(0xffaa00).setDepth(5);
            proj.isWand = true; proj.wandDmg = dmg;
            this.physics.moveTo(proj, target.x, target.y, 480);
            this.time.delayedCall(2000, () => { if (proj.active) proj.destroy(); });
        });
        this.playSound('shoot', { volume: 0.25 });
    }

    // ================================================================
    //  COLLISION CALLBACKS
    // ================================================================

    onProjectileHitEnemy(proj, enemy) {
        if (!enemy.active) return;
        const ex = enemy.x, ey = enemy.y;
        const baseDmg = proj.isWand ? (proj.wandDmg || 15) : this.stats.damage;
        const prevHp  = enemy.hp;
        proj.destroy();

        // Crit roll — Cloak + Lucky add to critChance
        const isCrit = Math.random() < this.stats.critChance;
        const dmg    = isCrit ? baseDmg * this.stats.critDamage : baseDmg;

        // Freeze augment — slow the enemy (stacks up to freeze)
        if (this.augLevel('freeze') && Math.random() < 0.25) {
            const stacks = 1 + this.augLevel('freeze'); // extra stacks per level
            this.applyDebuff(enemy, 'slow', stacks);
        }

        // Chain augment — bounce to up to (chain level) more enemies
        if (!proj.isChained && this.augLevel('chain')) {
            const chainCount = this.augLevel('chain');
            let   lastPos    = { x: ex, y: ey };
            let   excluded   = [enemy];
            for (let c = 0; c < chainCount; c++) {
                const ct = this.findNearestEnemy(lastPos.x, lastPos.y, excluded);
                if (!ct) break;
                excluded.push(ct);
                const chain = this.playerProjectiles.create(lastPos.x, lastPos.y, 'projectile');
                if (chain) {
                    chain.setTint(0xffff44).setDepth(5);
                    chain.isChained = true;
                    this.physics.moveTo(chain, ct.x, ct.y, 500);
                    this.time.delayedCall(2000, () => { if (chain.active) chain.destroy(); });
                }
                lastPos = { x: ct.x, y: ct.y };
            }
        }

        this.applyDamageToEnemy(enemy, dmg);

        // Ricochet — on crit, bounce a projectile (1 bounce per Ricochet level)
        if (isCrit && this.augLevel('ricochet')) {
            const bounceCount = this.augLevel('ricochet');
            let lastPos = { x: ex, y: ey };
            let excluded = [enemy];
            for (let b = 0; b < bounceCount; b++) {
                const bt = this.findNearestEnemy(lastPos.x, lastPos.y, excluded);
                if (!bt) break;
                excluded.push(bt);
                const bounce = this.playerProjectiles.create(lastPos.x, lastPos.y, 'projectile');
                if (bounce) {
                    bounce.setTint(0xffffff).setDepth(5);
                    this.physics.moveTo(bounce, bt.x, bt.y, 500);
                    this.time.delayedCall(2000, () => { if (bounce.active) bounce.destroy(); });
                }
                lastPos = { x: bt.x, y: bt.y };
            }
        }

        // Overkill — excess damage splashes to nearby enemies
        if (this.augLevel('overkill') && prevHp > 0 && prevHp < dmg) {
            const excess = dmg - prevHp;
            const radius = 80 + this.augLevel('overkill') * 20;
            this.enemies.getChildren().forEach(other => {
                if (other === enemy) return;
                if (Phaser.Math.Distance.Between(ex, ey, other.x, other.y) < radius) {
                    this.applyDamageToEnemy(other, excess);
                }
            });
        }
    }

    onEnemyProjectileHitPlayer(player, proj) {
        proj.destroy();
        this.damagePlayer(proj.damage || 8);
    }

    onEnemyTouchPlayer(player, enemy) {
        if (enemy.enemyType !== 'rusher' && enemy.enemyType !== 'boss') return;
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
        if (!enemy.active) return;

        // Vulnerable debuff — each stack adds 15% more damage taken
        let finalDmg = damage;
        if (enemy.debuffs?.vulnerable?.stacks) {
            finalDmg *= (1 + enemy.debuffs.vulnerable.stacks * 0.15);
        }

        enemy.hp -= finalDmg;
        if (!silent) {
            this.tweens.add({ targets: enemy, alpha: 0.4, duration: 60, yoyo: true });
            this.playSound('hit', { volume: 0.3 });
        }

        if (enemy.hp <= 0) this.enemyDied(enemy);
    }

    enemyDied(enemy) {
        if (!enemy.active) return;
        this.dropXpOrb(enemy.x, enemy.y, enemy.xpValue);

        if (this.augLevel('deathPool')) this.createDeathPool(enemy.x, enemy.y);

        if (enemy.enemyType === 'boss') {
            this.bossAlive = false;
            this.playSound('boss_death', { volume: 0.8 });
            enemy.destroy();
            this.triggerWin();
            return;
        }

        this.playSound('enemy_death', { volume: 0.25 });
        enemy.destroy();
    }

    damagePlayer(amount) {
        if (!this.gameActive) return;

        // Shield absorbs the hit — triggers recharge if not already recharging
        if (this.shieldCharges > 0) {
            this.shieldCharges--;
            this.cameras.main.flash(80, 0, 100, 255);
            if (!this.shieldRecharging) this.startShieldRecharge();
            return;
        }

        this.stats.hp -= amount;
        this.cameras.main.flash(120, 255, 0, 0);
        this.player.setTint(0xff4444);
        this.playSound('player_hurt', { volume: 0.6 });
        this.time.delayedCall(200, () => { if (this.player.active) this.player.clearTint(); });

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
            { id: 'overkill',    type: 'augment', name: 'Overkill',     icon: '💥', maxLevel: 4,  desc: lv => `Excess dmg splashes ${80 + lv*20}px radius` },
            { id: 'ricochet',    type: 'augment', name: 'Ricochet',     icon: '↩',  maxLevel: 4,  desc: lv => `Crits bounce ${lv} time${lv>1?'s':''}` },
            { id: 'deathPool',   type: 'augment', name: 'Death Pool',   icon: '☠',  maxLevel: 4,  desc: lv => `Bleed puddles deal ${5+lv*3} DPS` },
            { id: 'freeze',      type: 'augment', name: 'Freeze',       icon: '❄',  maxLevel: 3,  desc: lv => `Slow 20% per stack (+${lv} stacks), x5=freeze` },
            { id: 'chain',       type: 'augment', name: 'Chain',        icon: '🔗', maxLevel: 3,  desc: lv => `Attacks chain to ${lv} extra enem${lv>1?'ies':'y'}` },
            { id: 'proliferate', type: 'augment', name: 'Proliferate',  icon: '🌀', maxLevel: 4,  desc: lv => `+${lv} debuff stacks, +${(Math.min(4,lv*1.5)).toFixed(1)}s duration` },
            { id: 'aura',        type: 'augment', name: 'Aura',         icon: '🔵', maxLevel: 3,  desc: lv => `Rotating rings: ${lv*5} dmg, knockback, Vulnerable` },
            { id: 'lucky',       type: 'augment', name: 'Lucky',        icon: '🍀', maxLevel: 3,  desc: lv => `+${lv*5}% crit chance, better upgrade pool` },
            { id: 'shield',      type: 'augment', name: 'Shield',       icon: '🛡',  maxLevel: 3,  desc: lv => `${lv} block${lv>1?'s':''}, ${Math.max(8,20-lv*4)}s recharge` },
            { id: 'wand',        type: 'augment', name: 'Wand',         icon: '🪄', maxLevel: 4,  desc: lv => `Auto-fire ${8+lv*5} dmg${lv>=4?', 2 shots':''}` },
            { id: 'cloak',       type: 'augment', name: 'Cloak',        icon: '🎯', maxLevel: 5,  desc: lv => `+${lv*19}% crit chance${lv>=5?', +20% crit dmg':''}` },
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
                case 'wand':
                    this.setupWand(newLevel);
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
            overkill:'💥', ricochet:'↩', deathPool:'☠', freeze:'❄', chain:'🔗',
            proliferate:'🌀', aura:'🔵', lucky:'🍀', shield:'🛡', wand:'🪄', cloak:'🎯'
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
        this.physics.world.pause();
        this.stopMusic();
        this.time.delayedCall(800, () => this.scene.start('deathScene', { survivalTime: this.gameTime, level: this.level }));
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
