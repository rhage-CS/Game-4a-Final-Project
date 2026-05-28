// SettingsScene.js — Volume settings overlay.
// Launched on top of whatever scene is currently running.
// Opens from TitleScene (gear button) or GameScene (ESC key).
// Closing it resumes the calling scene automatically.

class SettingsScene extends Phaser.Scene {
    constructor() {
        super('settingsScene');
    }

    // fromScene tells us which scene to resume when we close
    init(data) {
        this.fromScene = data.fromScene || 'titleScene';
    }

    create() {
        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        // Semi-transparent black layer over whatever is behind
        this.add.rectangle(cx, cy, W, H, 0x000000, 0.72);

        // Panel background
        this.add.rectangle(cx, cy, 500, 340, 0x0e0e22)
            .setStrokeStyle(2, 0x4455aa);

        // Title
        this.add.text(cx, cy - 135, 'SETTINGS', {
            fontSize: '26px', color: '#ffcc44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        // Divider line
        this.add.rectangle(cx, cy - 108, 440, 1, 0x334466);

        // Music volume slider
        this.createSlider(cx, cy - 55, 'Music Volume', 'musicVolume', (vol) => {
            // Live-update any currently playing music track
            const MUSIC_KEYS = ['menu_music', 'game_music', 'boss_music'];
            this.sound.sounds.forEach(s => {
                if (MUSIC_KEYS.includes(s.key)) s.setVolume(vol);
            });
        });

        // SFX volume slider
        this.createSlider(cx, cy + 30, 'SFX Volume', 'sfxVolume', (vol) => {
            // SFX volume is read per-call in GameScene.playSound() — nothing to update live
        });

        // Close button
        const closeBtn = this.add.text(cx, cy + 125, 'CLOSE', {
            fontSize: '20px', color: '#ffffff', backgroundColor: '#223344',
            padding: { x: 36, y: 10 }, stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerover', () => { closeBtn.setColor('#ffff00'); closeBtn.setBackgroundColor('#334455'); });
        closeBtn.on('pointerout',  () => { closeBtn.setColor('#ffffff'); closeBtn.setBackgroundColor('#223344'); });
        closeBtn.on('pointerdown', () => this.closeSettings());

        // ESC also closes the panel
        this.input.keyboard.once('keydown-ESC', () => this.closeSettings());
    }

    // Draws a labelled volume slider with − / + buttons and a clickable track.
    // registryKey is 'musicVolume' or 'sfxVolume'.
    // onChange(vol) fires whenever the value changes.
    createSlider(x, y, label, registryKey, onChange) {
        const trackW = 260;
        const trackH = 18;
        const btnX   = x - trackW / 2 - 28; // position of − button
        const plusX  = x + trackW / 2 + 28; // position of + button

        // Label above the track
        this.add.text(x, y - 22, label, {
            fontSize: '14px', color: '#9999bb'
        }).setOrigin(0.5);

        // Track background
        this.add.rectangle(x, y, trackW, trackH, 0x1a1a33)
            .setStrokeStyle(1, 0x3344aa);

        // Filled portion — width represents current volume
        const curVol = this.game.registry.get(registryKey) ?? 0.5;
        const fill   = this.add.rectangle(
            x - trackW / 2, y, trackW * curVol, trackH, 0x3377ff
        ).setOrigin(0, 0.5);

        // Percentage label to the right of the track
        const pct = this.add.text(plusX + 22, y, `${Math.round(curVol * 100)}%`, {
            fontSize: '13px', color: '#cccccc'
        }).setOrigin(0, 0.5);

        // Centralised update function — sets registry, updates display, fires callback
        const apply = (vol) => {
            const clamped = Math.round(Phaser.Math.Clamp(vol, 0, 1) * 100) / 100;
            fill.setDisplaySize(trackW * clamped, trackH);
            pct.setText(`${Math.round(clamped * 100)}%`);
            this.game.registry.set(registryKey, clamped);
            this.saveSettings();
            onChange(clamped);
        };

        // Minus button — steps down by 10%
        const minusBtn = this.add.text(btnX, y, '−', {
            fontSize: '22px', color: '#aaaaee'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        minusBtn.on('pointerover', () => minusBtn.setColor('#ffffff'));
        minusBtn.on('pointerout',  () => minusBtn.setColor('#aaaaee'));
        minusBtn.on('pointerdown', () => {
            apply((this.game.registry.get(registryKey) ?? 0.5) - 0.1);
        });

        // Plus button — steps up by 10%
        const plusBtn = this.add.text(plusX, y, '+', {
            fontSize: '22px', color: '#aaaaee'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        plusBtn.on('pointerover', () => plusBtn.setColor('#ffffff'));
        plusBtn.on('pointerout',  () => plusBtn.setColor('#aaaaee'));
        plusBtn.on('pointerdown', () => {
            apply((this.game.registry.get(registryKey) ?? 0.5) + 0.1);
        });

        // Invisible hit zone over the track — click anywhere to set volume directly
        const hitZone = this.add.rectangle(x, y, trackW, trackH + 12, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const setFromPointer = (pointer) => {
            const localX = pointer.x - (x - trackW / 2);
            apply(localX / trackW);
        };

        hitZone.on('pointerdown', setFromPointer);
        hitZone.on('pointermove', (pointer) => {
            if (pointer.isDown) setFromPointer(pointer);
        });
    }

    // Writes current registry values back to localStorage so they survive page reloads
    saveSettings() {
        const data = {
            musicVolume: this.game.registry.get('musicVolume') ?? 0.5,
            sfxVolume:   this.game.registry.get('sfxVolume')   ?? 0.7
        };
        localStorage.setItem('survivorSettings', JSON.stringify(data));
    }

    // Resumes the calling scene and shuts this overlay down
    closeSettings() {
        if (this.fromScene === 'gameScene') {
            this.scene.resume('gameScene');
        }
        this.scene.stop('settingsScene');
    }
}
