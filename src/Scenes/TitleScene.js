// TitleScene.js — The main menu screen.
// Shows the game title, best time from a previous run, class 2 unlock status,
// and a button to go to class select. Plays menu_music on loop.

class TitleScene extends Phaser.Scene {
    constructor() {
        super('titleScene');
    }

    create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // ── Animated GIF background ────────────────────────────────────
        // Inject a DOM <img> behind the Phaser canvas so the browser
        // plays the GIF animation natively (Phaser only shows first frame).
        this._bgImg = document.createElement('img');
        this._bgImg.src = 'assets/Map_Tileset/Background.gif';
        this._bgImg.style.cssText = [
            'position:absolute',
            'top:0', 'left:0',
            'width:100%', 'height:100%',
            'object-fit:cover',
            'z-index:0',
            'pointer-events:none',
        ].join(';');

        const container = document.getElementById('phaser-game');
        container.style.position = 'relative';
        container.prepend(this._bgImg);

        // Make the Phaser canvas sit above the GIF
        const canvas = this.game.canvas;
        canvas.style.position = 'relative';
        canvas.style.zIndex   = '1';

        // Thin dark overlay so text stays readable over the GIF
        this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.45);

        // Remove the GIF when this scene shuts down or is replaced
        this.events.once('shutdown', () => { if (this._bgImg) { this._bgImg.remove(); this._bgImg = null; } });
        this.events.once('destroy',  () => { if (this._bgImg) { this._bgImg.remove(); this._bgImg = null; } });

        // Play menu music using the saved volume from settings
        if (this.cache.audio.has('menu_music')) {
            const vol = this.game.registry.get('musicVolume') ?? 0.5;
            this.bgm  = this.sound.add('menu_music', { volume: vol, loop: true });
            this.bgm.play();
        }

        // Gear button — opens the settings overlay
        const gear = this.add.text(this.scale.width - 20, 20, '⚙', {
            fontFamily: 'Arial', fontSize: '28px', color: '#aaaacc'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

        gear.on('pointerover', () => gear.setColor('#ffffff'));
        gear.on('pointerout',  () => gear.setColor('#aaaacc'));
        gear.on('pointerdown', () => {
            this.scene.launch('settingsScene', { fromScene: 'titleScene' });
        });

        // Subtle particle shimmer over the GIF background
        for (let i = 0; i < 40; i++) {
            const x     = Phaser.Math.Between(0, this.scale.width);
            const y     = Phaser.Math.Between(0, this.scale.height);
            const r     = Phaser.Math.FloatBetween(0.5, 1.8);
            const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
            const star  = this.add.circle(x, y, r, 0xffffff, alpha);
            this.tweens.add({
                targets:  star,
                alpha:    0.05,
                duration: Phaser.Math.Between(800, 3000),
                yoyo:     true,
                repeat:   -1,
                delay:    Phaser.Math.Between(0, 2000)
            });
        }

        // Blurred glow layer behind the title text (low alpha, larger font)
        this.add.text(cx, cy - 160, 'SURVIVOR', {
            fontFamily: 'Arial', fontSize: '72px', color: '#ff6600', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0.2);

        // Main title — pulses gently using a yoyo scale tween
        const title = this.add.text(cx, cy - 160, 'SURVIVOR', {
            fontFamily: 'Arial', fontSize: '68px', color: '#ffcc44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title, scaleX: 1.03, scaleY: 1.03,
            duration: 1200, yoyo: true, ease: 'Sine.easeInOut', repeat: -1
        });

        this.add.text(cx, cy - 90, 'Fight. Survive. Evolve.', {
            fontFamily: 'Arial', fontSize: '20px', color: '#aaaacc', fontStyle: 'italic'
        }).setOrigin(0.5);

        // Pull save data from localStorage to show best time and unlock status
        const save = this.getSave();
        if (save && save.bestTime) {
            const mins = Math.floor(save.bestTime / 60);
            const secs = String(Math.floor(save.bestTime % 60)).padStart(2, '0');
            this.add.text(cx, cy - 40, `Best Time: ${mins}:${secs}`, {
                fontFamily: 'Arial', fontSize: '16px', color: '#66ff88'
            }).setOrigin(0.5);
        }

        // Start button — goes directly to the game
        const startBtn = this.add.text(cx, cy + 60, '▶  START GAME', {
            fontFamily: 'Arial', fontSize: '28px', color: '#ffffff', backgroundColor: '#1a4a1a',
            padding: { x: 24, y: 12 }, stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        startBtn.on('pointerover', () => { startBtn.setColor('#ffff00'); startBtn.setBackgroundColor('#2a6a2a'); });
        startBtn.on('pointerout',  () => { startBtn.setColor('#ffffff'); startBtn.setBackgroundColor('#1a4a1a'); });
        startBtn.on('pointerdown', () => this.scene.start('gameScene'));

        // Keyboard shortcuts — Enter or Space also starts the game
        this.input.keyboard.once('keydown-ENTER', () => this.scene.start('gameScene'));
        this.input.keyboard.once('keydown-SPACE', () => this.scene.start('gameScene'));

        // Controls reminder — bright enough to read over the GIF background overlay
        this.add.text(cx, cy + 140, 'WASD / Arrow Keys to move  •  Auto-attacks', {
            fontFamily: 'Arial', fontSize: '14px', color: '#e8e8ff',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        this.add.text(cx, cy + 165, 'Survive 15 minutes and defeat the boss to win', {
            fontFamily: 'Arial', fontSize: '14px', color: '#c8ffda',
            stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // Credits line at bottom of screen
        this.add.text(cx, this.scale.height - 18,
            'Enemy Sprites: luizmelo  •  Icons: clockworkraven  •  Effects: untiedgames',
            { fontFamily: 'Arial', fontSize: '11px', color: '#333355' }
        ).setOrigin(0.5);
    }

    // Read save data from localStorage — returns null if nothing saved yet
    getSave() {
        try {
            return JSON.parse(localStorage.getItem('survivorData'));
        } catch (e) {
            return null;
        }
    }
}
