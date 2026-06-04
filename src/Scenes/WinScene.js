// WinScene.js — Shown when the player kills the boss.
// Displays survival time, best time from localStorage, class 2 unlock confirmation,
// and a play again button. Also launches a confetti celebration.

class WinScene extends Phaser.Scene {
    constructor() {
        super('winScene');
    }

    // init() runs before create() — receives data passed from GameScene.triggerWin()
    init(data) {
        this.survivalTime = data.survivalTime || 0;
    }

    create() {
        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        this.add.rectangle(cx, cy, W, H, 0x010108);

        // Staggered confetti bursts across the screen width
        for (let i = 0; i < 6; i++) {
            const px = Phaser.Math.Between(80, W - 80);
            this.time.addEvent({
                delay: i * 200,
                callback: () => this.launchConfetti(px, H + 20),
                loop: false
            });
        }

        // Faint glow version of the title (rendered first, behind main title)
        this.add.text(cx, cy - 140, 'YOU WIN!', {
            fontSize: '72px', color: '#ffaa00', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0.25);

        // Main title with a subtle breathing scale tween
        const title = this.add.text(cx, cy - 140, 'YOU WIN!', {
            fontSize: '68px', color: '#ffff44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title, scaleX: 1.04, scaleY: 1.04,
            duration: 900, yoyo: true, ease: 'Sine.easeInOut', repeat: -1
        });

        this.add.text(cx, cy - 70, 'The boss has been defeated!', {
            fontSize: '22px', color: '#aaffcc', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // Show this run's survival time
        const mins = Math.floor(this.survivalTime / 60);
        const secs = String(Math.floor(this.survivalTime % 60)).padStart(2, '0');
        this.add.text(cx, cy - 30, `Survival Time: ${mins}:${secs}`, {
            fontSize: '20px', color: '#88ffaa'
        }).setOrigin(0.5);

        // Show all-time best time if one exists in localStorage
        const save = this.getSave();
        if (save && save.bestTime) {
            const bm = Math.floor(save.bestTime / 60);
            const bs = String(save.bestTime % 60).padStart(2, '0');
            this.add.text(cx, cy + 5, `Best Time: ${bm}:${bs}`, {
                fontSize: '16px', color: '#55bb77'
            }).setOrigin(0.5);
        }

        // Confirm that class 2 is now available (GameScene already saved this)
        if (save && save.completedRun) {
            this.add.text(cx, cy + 35, '✓ Class 2 Unlocked', {
                fontSize: '16px', color: '#aa66ff'
            }).setOrigin(0.5);
        }

        // Play Again — goes back to title screen
        const btn = this.add.text(cx, cy + 100, '▶  PLAY AGAIN', {
            fontSize: '26px', color: '#ffffff', backgroundColor: '#1a4a1a',
            padding: { x: 24, y: 12 }, stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => { btn.setColor('#ffff00'); btn.setBackgroundColor('#2a6a2a'); });
        btn.on('pointerout',  () => { btn.setColor('#ffffff'); btn.setBackgroundColor('#1a4a1a'); });
        btn.on('pointerdown', () => this.scene.start('titleScene'));

        this.add.text(cx, cy + 155, 'or press R to return to title', {
            fontSize: '14px', color: '#555577'
        }).setOrigin(0.5);

        this.input.keyboard.once('keydown-R', () => this.scene.start('titleScene'));

        // ── Asset Credits ─────────────────────────────────────────────
        const credY = H - 72;
        this.add.text(cx, credY, 'Asset Credits', {
            fontSize: '13px', color: '#666688', fontStyle: 'bold'
        }).setOrigin(0.5);

        const credits = [
            'Enemy Sprites — luizmelo  (luizmelo.itch.io/monsters-creatures-fantasy)',
            'Icons          — clockworkraven  (clockworkraven.itch.io/raven-fantasy-icons)',
            'Spell Effects  — untiedgames  (untiedgames.itch.io/super-pixel-effects-gigapack)',
        ];
        credits.forEach((line, i) => {
            this.add.text(cx, credY + 18 + i * 16, line, {
                fontSize: '11px', color: '#444466'
            }).setOrigin(0.5);
        });
    }

    // Spawns a burst of colourful rectangles that fly up from a point and fade out
    launchConfetti(x, startY) {
        const colors = [0xffff44, 0xff44aa, 0x44ffaa, 0xaa44ff, 0xff8844];
        for (let i = 0; i < 8; i++) {
            const dot = this.add.rectangle(
                x + Phaser.Math.Between(-40, 40), startY,
                6, 6, Phaser.Utils.Array.GetRandom(colors)
            );
            this.tweens.add({
                targets:  dot,
                x:        dot.x + Phaser.Math.Between(-80, 80),
                y:        Phaser.Math.Between(0, this.scale.height - 100),
                angle:    Phaser.Math.Between(0, 720),
                alpha:    0,
                duration: Phaser.Math.Between(1200, 2500),
                ease:     'Quad.easeOut',
                onComplete: () => dot.destroy()
            });
        }
    }

    getSave() {
        try { return JSON.parse(localStorage.getItem('survivorData')); } catch (e) { return null; }
    }
}
