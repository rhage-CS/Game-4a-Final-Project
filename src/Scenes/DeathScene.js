// DeathScene.js — Shown when the player's HP hits 0.
// Displays how long the player survived and what level they reached,
// a random tip, and buttons to retry (class select) or return to title.

class DeathScene extends Phaser.Scene {
    constructor() {
        super('deathScene');
    }

    // init() runs before create() — receives data passed from GameScene.triggerDeath()
    init(data) {
        this.survivalTime = data.survivalTime || 0;
        this.level        = data.level || 1;
    }

    create() {
        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        this.add.rectangle(cx, cy, W, H, 0x080004);

        // Faint glow layer behind the title
        this.add.text(cx, cy - 130, 'YOU DIED', {
            fontFamily: 'Arial', fontSize: '72px', color: '#880000', fontStyle: 'bold'
        }).setOrigin(0.5).setAlpha(0.4);

        // Main title — alpha pulse to give it an ominous feel
        const title = this.add.text(cx, cy - 130, 'YOU DIED', {
            fontFamily: 'Arial', fontSize: '68px', color: '#ff2222', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: title, alpha: 0.5, duration: 700,
            yoyo: true, ease: 'Sine.easeInOut', repeat: -1
        });

        this.add.text(cx, cy - 60, "You didn't survive...", {
            fontFamily: 'Arial', fontSize: '22px', color: '#cc8888', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5);

        // How long the player lasted this run
        const mins = Math.floor(this.survivalTime / 60);
        const secs = String(Math.floor(this.survivalTime % 60)).padStart(2, '0');
        this.add.text(cx, cy - 15, `Survived: ${mins}:${secs}`, {
            fontFamily: 'Arial', fontSize: '20px', color: '#ff8888'
        }).setOrigin(0.5);

        // What level they reached
        this.add.text(cx, cy + 15, `Reached Level: ${this.level}`, {
            fontFamily: 'Arial', fontSize: '18px', color: '#cc6666'
        }).setOrigin(0.5);

        // Pick a random tip to show — add more tips here if you want
        const tips = [
            'Tip: Collect XP orbs to level up faster',
            "Tip: Move constantly — don't stand still",
            'Tip: Augments stack with stat upgrades',
            'Tip: The Freeze augment helps with ranged enemies',
            'Tip: Death Pool is strong against dense groups',
        ];
        this.add.text(cx, cy + 55, Phaser.Utils.Array.GetRandom(tips), {
            fontFamily: 'Arial', fontSize: '14px', color: '#775555', fontStyle: 'italic'
        }).setOrigin(0.5);

        // Try Again — sends player back to class select to start a new run
        const retryBtn = this.add.text(cx, cy + 110, '↺  TRY AGAIN', {
            fontFamily: 'Arial', fontSize: '26px', color: '#ffffff', backgroundColor: '#4a1a1a',
            padding: { x: 24, y: 12 }, stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        retryBtn.on('pointerover', () => { retryBtn.setColor('#ffff00'); retryBtn.setBackgroundColor('#6a2a2a'); });
        retryBtn.on('pointerout',  () => { retryBtn.setColor('#ffffff'); retryBtn.setBackgroundColor('#4a1a1a'); });
        retryBtn.on('pointerdown', () => this.scene.start('classSelectScene'));

        // Return to Title — goes all the way back to the main menu
        const titleBtn = this.add.text(cx, cy + 165, 'Return to Title', {
            fontFamily: 'Arial', fontSize: '16px', color: '#888888', padding: { x: 10, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        titleBtn.on('pointerover', () => titleBtn.setColor('#ffffff'));
        titleBtn.on('pointerout',  () => titleBtn.setColor('#888888'));
        titleBtn.on('pointerdown', () => this.scene.start('titleScene'));

        // R key shortcut — same as Try Again
        this.input.keyboard.once('keydown-R', () => this.scene.start('classSelectScene'));
    }
}
