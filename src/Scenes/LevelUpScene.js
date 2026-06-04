// LevelUpScene.js — Upgrade selection overlay shown every time the player levels up.
// Launched on top of (and pausing) GameScene. Reads pendingUpgrades from the registry.
// Each upgrade object now includes currentLevel and nextLevel so the card can show
// whether this is a first pick or a level-up of something the player already has.

class LevelUpScene extends Phaser.Scene {
    constructor() {
        super('levelUpScene');
    }

    create() {
        const W  = this.scale.width;
        const H  = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        const upgrades = this.game.registry.get('pendingUpgrades') || [];
        const level    = this.game.registry.get('currentLevel') || '?';

        // Dark overlay so the paused game shows behind
        this.add.rectangle(cx, cy, W, H, 0x000000, 0.75);

        this.add.text(cx, cy - 200, `LEVEL UP!  →  Lv. ${level}`, {
            fontSize: '32px', color: '#ffcc44', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 5
        }).setOrigin(0.5);

        this.add.text(cx, cy - 158, 'Choose an upgrade:', {
            fontSize: '18px', color: '#aaaacc'
        }).setOrigin(0.5);

        // Space cards evenly (up to 3)
        const cardW   = 210;
        const cardH   = 250;
        const spacing = 250;
        const count   = upgrades.length;
        const startX  = cx - ((count - 1) * spacing) / 2;

        upgrades.forEach((upgrade, i) => {
            this.createUpgradeCard(startX + i * spacing, cy + 20, cardW, cardH, upgrade);
        });

        this.add.text(cx, cy + 180, 'Click a card to choose', {
            fontSize: '14px', color: '#555577'
        }).setOrigin(0.5);
    }

    createUpgradeCard(x, y, w, h, upgrade) {
        const isAugment   = upgrade.type === 'augment';
        const isLevelUp   = (upgrade.currentLevel || 0) > 0; // already have this — leveling it up
        const borderColor = isAugment ? 0xffaa00 : 0x3388ff;

        const bg = this.add.rectangle(x, y, w, h, 0x111133)
            .setStrokeStyle(2, borderColor);

        // Icon — PNG if available, emoji text fallback
        const iconKey = upgrade.iconKey;
        if (iconKey && this.textures.exists(iconKey)) {
            this.add.image(x, y - h / 2 + 44, iconKey).setDisplaySize(48, 48).setOrigin(0.5);
        } else {
            this.add.text(x, y - h / 2 + 38, upgrade.icon || '?', {
                fontSize: '34px'
            }).setOrigin(0.5);
        }

        // Type badge (AUGMENT / STAT) + new vs level-up indicator
        const badgeLabel = isAugment ? 'AUGMENT' : 'STAT';
        const badgeColor = isAugment ? '#ffaa44' : '#4499ff';
        this.add.text(x, y - h / 2 + 76, badgeLabel, {
            fontSize: '11px', color: badgeColor
        }).setOrigin(0.5);

        // Level indicator — shows "NEW" if first pick, or "Lv.N → Lv.N+1" if leveling up
        const lvLabel = isLevelUp
            ? `Lv.${upgrade.currentLevel} → Lv.${upgrade.nextLevel}`
            : 'NEW';
        const lvColor = isLevelUp ? '#ffdd66' : '#88ff88';
        this.add.text(x, y - h / 2 + 94, lvLabel, {
            fontSize: '11px', color: lvColor, fontStyle: 'bold'
        }).setOrigin(0.5);

        // Max level indicator
        this.add.text(x, y - h / 2 + 108, `Max: ${upgrade.maxLevel}`, {
            fontSize: '10px', color: '#555577'
        }).setOrigin(0.5);

        // Upgrade name
        this.add.text(x, y - h / 2 + 130, upgrade.name, {
            fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // Description of what this level gives
        this.add.text(x, y - h / 2 + 162, upgrade.desc, {
            fontSize: '12px', color: '#aaaacc', align: 'center',
            wordWrap: { width: w - 20 }
        }).setOrigin(0.5);

        // Invisible hit zone over the whole card
        const hitZone = this.add.rectangle(x, y, w, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        hitZone.on('pointerover', () => { bg.setStrokeStyle(3, 0xffffff); bg.setFillStyle(0x1a1a44); });
        hitZone.on('pointerout',  () => { bg.setStrokeStyle(2, borderColor); bg.setFillStyle(0x111133); });
        hitZone.on('pointerdown', () => this.chooseUpgrade(upgrade));
    }

    chooseUpgrade(upgrade) {
        this.game.registry.set('chosenUpgrade', upgrade);
        this.scene.resume('gameScene');
        this.scene.stop('levelUpScene');
    }
}
