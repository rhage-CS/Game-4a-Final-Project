// ClassSelect.js — Class selection screen shown before each run.
// Class 1 (Ranger) is always available.
// Class 2 (Nova) is locked until the player completes a run and saves to localStorage.
// Clicking a class card starts GameScene and passes { classId } as data.

class ClassSelect extends Phaser.Scene {
    constructor() {
        super('classSelectScene');
    }

    create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Check if class 2 has been unlocked from a previous completed run
        const save          = this.getSave();
        const class2Unlocked = save && save.completedRun;

        this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x050510);

        this.add.text(cx, 60, 'SELECT YOUR CLASS', {
            fontSize: '36px', color: '#ffcc44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(cx, 100, 'Pick a class to begin your run', {
            fontSize: '16px', color: '#888899'
        }).setOrigin(0.5);

        // Class 1 — always unlocked, single targeted shot, balanced stats
        this.createClassCard(
            cx - 250, cy,
            'CLASS 1', 'Ranger', 'player1',
            ['100 HP', '200 Move Speed', 'Single targeted shot', 'High damage, precise', '1 shot / second'],
            0x3388ff, true, 1
        );

        // Class 2 — unlocked after first completed run, fires 8 directions at once
        this.createClassCard(
            cx + 250, cy,
            'CLASS 2', 'Nova', 'player2',
            ['80 HP', '170 Move Speed', '8-way nova burst', 'Wide coverage, lower damage', '1.5 sec cooldown'],
            0xaa33ff, class2Unlocked, 2
        );

        // Back button returns to the title screen
        const backBtn = this.add.text(cx, this.scale.height - 50, '← Back', {
            fontSize: '18px', color: '#888888', padding: { x: 12, y: 6 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
        backBtn.on('pointerout',  () => backBtn.setColor('#888888'));
        backBtn.on('pointerdown', () => this.scene.start('titleScene'));
    }

    // Builds a class card at position (x, y).
    // If unlocked is false the card is dimmed and shows a lock icon instead of the SELECT button.
    createClassCard(x, y, label, name, textureKey, stats, color, unlocked, classId) {
        const cardW = 220;
        const cardH = 360;

        // Card background — dimmed if locked
        const cardBg = this.add.rectangle(x, y, cardW, cardH, 0x111122, unlocked ? 1 : 0.5)
            .setStrokeStyle(2, color, unlocked ? 1 : 0.3);

        // Small "CLASS 1" / "CLASS 2" label at the top
        this.add.text(x, y - cardH / 2 + 24, label, {
            fontSize: '12px', color: '#888899'
        }).setOrigin(0.5);

        // Class name in the card's accent color
        this.add.text(x, y - cardH / 2 + 48, name, {
            fontSize: '24px',
            color: unlocked ? `#${color.toString(16).padStart(6, '0')}` : '#555566',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Avatar sprite preview
        const avatarBg = this.add.circle(x, y - 50, 38, 0x000000, 0.4);
        const avatar   = this.add.image(x, y - 50, textureKey).setScale(2.2);
        if (!unlocked) avatar.setTint(0x333344); // grey out if locked

        // List of stats below the avatar
        stats.forEach((line, i) => {
            this.add.text(x, y + 30 + i * 24, line, {
                fontSize: '13px',
                color: unlocked ? '#aaaacc' : '#444455',
                align: 'center'
            }).setOrigin(0.5);
        });

        if (!unlocked) {
            // Show a lock icon and "complete a run to unlock" message instead of a button
            this.add.text(x, y - 50, '🔒', { fontSize: '32px' }).setOrigin(0.5);
            this.add.text(x, y + cardH / 2 - 32, 'Complete a run to unlock', {
                fontSize: '12px', color: '#556677'
            }).setOrigin(0.5);
            return;
        }

        // SELECT button — starts the game with this class
        const btn = this.add.text(x, y + cardH / 2 - 28, 'SELECT', {
            fontSize: '18px', color: '#ffffff',
            backgroundColor: '#' + color.toString(16).padStart(6, '0').replace(/^/, ''),
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        btn.setBackgroundColor('#' + color.toString(16).padStart(6, '0'));

        btn.on('pointerover', () => { btn.setColor('#ffff00'); cardBg.setStrokeStyle(3, color, 1); });
        btn.on('pointerout',  () => { btn.setColor('#ffffff'); cardBg.setStrokeStyle(2, color, 1); });
        btn.on('pointerdown', () => this.scene.start('gameScene', { classId }));
    }

    // Read save data — used to check if class 2 should be unlocked
    getSave() {
        try {
            return JSON.parse(localStorage.getItem('survivorData'));
        } catch (e) {
            return null;
        }
    }
}
