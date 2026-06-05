// SettingsScene.js — Pause / Stats overlay.
// Launched on top of GameScene (ESC) or TitleScene (gear icon).
// When opened from GameScene it shows live character stats and active augments.

class SettingsScene extends Phaser.Scene {
    constructor() { super('settingsScene'); }

    init(data) { this.fromGame = (data.fromScene || '') === 'gameScene'; }

    create() {
        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        // ── Backdrop ─────────────────────────────────────────────────
        this.add.rectangle(cx, cy, W, H, 0x000000, 0.78);

        if (this.fromGame) {
            this.buildGamePanel(cx, cy, W, H);
        } else {
            this.buildTitlePanel(cx, cy);
        }

        this.input.keyboard.once('keydown-ESC', () => this.closeSettings());
    }

    // ── Panel shared helpers ──────────────────────────────────────────

    panel(cx, cy, w, h) {
        // Outer glow
        this.add.rectangle(cx, cy, w + 8, h + 8, 0x2233aa, 0.25);
        // Main panel
        this.add.rectangle(cx, cy, w, h, 0x09091f)
            .setStrokeStyle(2, 0x3344aa);
        return { w, h };
    }

    sectionHeader(x, y, text) {
        this.add.rectangle(x, y + 10, 280, 1, 0x2244aa);
        return this.add.text(x, y, text.toUpperCase(), {
            fontFamily: 'Arial', fontSize: '11px', color: '#5566cc', fontStyle: 'bold', letterSpacing: 2
        }).setOrigin(0, 0);
    }

    statRow(x, y, label, value, color = '#ddddff') {
        this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '12px', color: '#8899bb' }).setOrigin(0, 0.5);
        this.add.text(x + 160, y, String(value), {
            fontFamily: 'Arial', fontSize: '13px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5);
    }

    closeButton(cx, y) {
        const btn = this.add.text(cx, y, 'RESUME  [ESC]', {
            fontFamily: 'Arial', fontSize: '17px', color: '#ffffff', backgroundColor: '#1a2a44',
            padding: { x: 28, y: 10 }, stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => { btn.setColor('#ffff44'); btn.setBackgroundColor('#243460'); });
        btn.on('pointerout',  () => { btn.setColor('#ffffff'); btn.setBackgroundColor('#1a2a44'); });
        btn.on('pointerdown', () => this.closeSettings());
    }

    // ── Title screen panel (no game data) ────────────────────────────

    buildTitlePanel(cx, cy) {
        this.panel(cx, cy, 420, 220);

        this.add.text(cx, cy - 80, 'SETTINGS', {
            fontFamily: 'Arial', fontSize: '24px', color: '#ffcc44', fontStyle: 'bold', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.rectangle(cx, cy - 56, 380, 1, 0x334466);

        this.createSlider(cx, cy - 10, 'Music Volume', 'musicVolume', vol => {
            this.sound.sounds.forEach(s => {
                if (['menu_music','game_music','boss_music'].includes(s.key)) s.setVolume(vol);
            });
        });

        this.closeButton(cx, cy + 72);
    }

    // ── In-game panel (stats + augments) ─────────────────────────────

    buildGamePanel(cx, cy, W, H) {
        const gs = this.scene.get('gameScene');

        // Wide panel
        const PW = Math.min(W - 40, 820);
        const PH = Math.min(H - 40, 540);
        this.panel(cx, cy, PW, PH);

        const top  = cy - PH / 2 + 20;
        const bot  = cy + PH / 2 - 20;
        const left = cx - PW / 2 + 30;
        const mid  = cx + 20;

        // ── Header ───────────────────────────────────────────────────
        this.add.text(cx, top + 4, 'PAUSED', {
            fontFamily: 'Arial', fontSize: '28px', color: '#ffcc44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5, 0);

        this.add.rectangle(cx, top + 40, PW - 30, 1, 0x2244aa);

        const statsTop = top + 54;
        const colW     = (PW - 60) / 2;

        // ── LEFT COLUMN: Character Stats ─────────────────────────────
        if (gs && gs.stats) {
            const s  = gs.stats;
            const lx = left;

            this.sectionHeader(lx, statsTop, 'Character Stats');

            const atkSpd = s.attackCooldown > 0
                ? (1000 / s.attackCooldown).toFixed(2) + '/s'
                : '—';
            const critPct = Math.round(s.critChance * 100) + '%';

            const rows = [
                ['❤  Health',      `${Math.ceil(s.hp)} / ${s.maxHp}`,       s.hp / s.maxHp > 0.5 ? '#44ff88' : s.hp / s.maxHp > 0.25 ? '#ffaa22' : '#ff4444'],
                ['⚔  Damage',       s.damage,                                '#ffdd88'],
                ['⚡  Atk Speed',    atkSpd,                                  '#88ccff'],
                ['👟  Move Speed',  s.moveSpeed,                              '#aaffcc'],
                ['💚  HP Regen',    s.hpRegen.toFixed(1) + ' /s',            '#88ff88'],
                ['🧲  Pickup Rad', s.pickupRange + 'px',                     '#ffaaff'],
                ['🎯  Crit Chance', critPct,                                  '#ffff66'],
                ['✦  Crit Dmg',    s.critDamage.toFixed(1) + '×',           '#ffcc44'],
                ['🔰  Level',       gs.level,                                 '#ffffff'],
            ];

            rows.forEach((r, i) => this.statRow(lx, statsTop + 22 + i * 26, r[0], r[1], r[2]));

            // Music slider at bottom of left column
            const sliderY = statsTop + 22 + rows.length * 26 + 22;
            this.sectionHeader(lx, sliderY, 'Audio');
            this.createSliderCompact(lx + 10, sliderY + 30, 'Music', 'musicVolume', vol => {
                this.sound.sounds.forEach(s2 => {
                    if (['menu_music','game_music','boss_music'].includes(s2.key)) s2.setVolume(vol);
                });
            });
        }

        // ── RIGHT COLUMN: Active Augments ────────────────────────────
        if (gs && gs.upgradeLevels && gs.getAllUpgrades) {
            const rx  = left + colW + 30;

            this.sectionHeader(rx, statsTop, 'Active Augments');

            const all    = gs.getAllUpgrades();
            const active = all.filter(u => u.type === 'augment' && (gs.upgradeLevels[u.id] || 0) > 0);

            if (active.length === 0) {
                this.add.text(rx, statsTop + 36, 'No augments yet — level up!', {
                    fontFamily: 'Arial', fontSize: '12px', color: '#445577', fontStyle: 'italic'
                }).setOrigin(0, 0);
            } else {
                const ICON = 22, GAP = 6, ROW_H = 34;
                active.forEach((u, i) => {
                    const row = i;
                    const ay  = statsTop + 22 + row * ROW_H;
                    const lv  = gs.upgradeLevels[u.id];

                    // Icon
                    if (u.iconKey && this.textures.exists(u.iconKey)) {
                        this.add.image(rx + ICON / 2, ay + ICON / 2, u.iconKey)
                            .setDisplaySize(ICON, ICON);
                    } else {
                        this.add.text(rx, ay + 2, u.icon || '?', {
                            fontFamily: 'Arial', fontSize: '16px'
                        }).setOrigin(0, 0);
                    }

                    // Name + level
                    this.add.text(rx + ICON + GAP + 2, ay + 2, u.name, {
                        fontFamily: 'Arial', fontSize: '13px', color: '#ccddff', fontStyle: 'bold'
                    }).setOrigin(0, 0);

                    // Level pip dots
                    for (let p = 0; p < u.maxLevel; p++) {
                        const filled = p < lv;
                        const dotX   = rx + ICON + GAP + 2 + p * 10;
                        this.add.circle(dotX + 4, ay + 22, 3,
                            filled ? 0x44aaff : 0x223355
                        );
                    }

                    // Short description
                    const shortDesc = u.desc(lv);
                    if (shortDesc) {
                        this.add.text(rx + ICON + GAP + 2 + u.maxLevel * 10 + 8, ay + 16,
                            shortDesc.length > 28 ? shortDesc.slice(0, 28) + '…' : shortDesc,
                            { fontFamily: 'Arial', fontSize: '10px', color: '#556677' }
                        ).setOrigin(0, 0.5);
                    }
                });
            }
        }

        // ── Close button ─────────────────────────────────────────────
        this.closeButton(cx, bot - 4);
    }

    // ── Slider (full, for title screen) ──────────────────────────────

    createSlider(x, y, label, key, onChange) {
        const tW = 240;
        const curVol = this.game.registry.get(key) ?? 0.5;

        this.add.text(x, y - 20, label, { fontFamily: 'Arial', fontSize: '13px', color: '#8899bb' }).setOrigin(0.5);
        this.add.rectangle(x, y, tW, 14, 0x111133).setStrokeStyle(1, 0x334488);

        const fill = this.add.rectangle(x - tW / 2, y, tW * curVol, 14, 0x3366ee).setOrigin(0, 0.5);
        const pct  = this.add.text(x + tW / 2 + 36, y, `${Math.round(curVol * 100)}%`, {
            fontFamily: 'Arial', fontSize: '13px', color: '#cccccc'
        }).setOrigin(0, 0.5);

        const apply = v => {
            const c = Math.round(Phaser.Math.Clamp(v, 0, 1) * 100) / 100;
            fill.setDisplaySize(tW * c, 14);
            pct.setText(`${Math.round(c * 100)}%`);
            this.game.registry.set(key, c);
            this.saveSettings();
            onChange(c);
        };

        const minus = this.add.text(x - tW / 2 - 20, y, '−', { fontFamily: 'Arial', fontSize: '20px', color: '#99aadd' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        minus.on('pointerover', () => minus.setColor('#fff')).on('pointerout', () => minus.setColor('#99aadd'))
             .on('pointerdown', () => apply((this.game.registry.get(key) ?? 0.5) - 0.1));

        const plus = this.add.text(x + tW / 2 + 20, y, '+', { fontFamily: 'Arial', fontSize: '20px', color: '#99aadd' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        plus.on('pointerover', () => plus.setColor('#fff')).on('pointerout', () => plus.setColor('#99aadd'))
            .on('pointerdown', () => apply((this.game.registry.get(key) ?? 0.5) + 0.1));

        const hit = this.add.rectangle(x, y, tW, 22, 0, 0).setInteractive({ useHandCursor: true });
        const fromPtr = p => apply((p.x - (x - tW / 2)) / tW);
        hit.on('pointerdown', fromPtr).on('pointermove', p => { if (p.isDown) fromPtr(p); });
    }

    // Compact slider for the in-game panel
    createSliderCompact(x, y, label, key, onChange) {
        const tW = 180;
        const curVol = this.game.registry.get(key) ?? 0.5;

        this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '11px', color: '#8899bb' }).setOrigin(0, 0.5);
        this.add.rectangle(x + 50, y, tW, 10, 0x111133).setStrokeStyle(1, 0x334488).setOrigin(0, 0.5);

        const fill = this.add.rectangle(x + 50, y, tW * curVol, 10, 0x3366ee).setOrigin(0, 0.5);
        const pct  = this.add.text(x + 50 + tW + 8, y, `${Math.round(curVol * 100)}%`, {
            fontFamily: 'Arial', fontSize: '11px', color: '#aaaacc'
        }).setOrigin(0, 0.5);

        const apply = v => {
            const c = Math.round(Phaser.Math.Clamp(v, 0, 1) * 100) / 100;
            fill.setDisplaySize(tW * c, 10);
            pct.setText(`${Math.round(c * 100)}%`);
            this.game.registry.set(key, c);
            this.saveSettings();
            onChange(c);
        };

        const hit = this.add.rectangle(x + 50 + tW / 2, y, tW, 18, 0, 0).setInteractive({ useHandCursor: true });
        const fromPtr = p => apply((p.x - (x + 50)) / tW);
        hit.on('pointerdown', fromPtr).on('pointermove', p => { if (p.isDown) fromPtr(p); });
    }

    saveSettings() {
        localStorage.setItem('survivorSettings', JSON.stringify({
            musicVolume: this.game.registry.get('musicVolume') ?? 0.5,
            sfxVolume:   this.game.registry.get('sfxVolume')   ?? 0.7
        }));
    }

    closeSettings() {
        if (this.fromGame) this.scene.resume('gameScene');
        this.scene.stop('settingsScene');
    }
}
