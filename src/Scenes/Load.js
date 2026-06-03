class Load extends Phaser.Scene {
    constructor() {
        super('loadScene');
    }

    preload() {
        this.showLoadingBar();

        // Player character — animated soldier spritesheets (96×96 frames, With_Shadows variant)
        const soldierPath = 'assets/PlayerCharacter/SpriteSheets(96x96)/Human_Soldier_Sword_Shield/With_Shadows/Human_Soldier_Sword_Shield';
        const sf = { frameWidth: 96, frameHeight: 96 };
        this.load.spritesheet('soldier_idle',    `${soldierPath}_Idle-Sheet.png`,    sf);
        this.load.spritesheet('soldier_walk',    `${soldierPath}_Walk-Sheet.png`,    sf);
        this.load.spritesheet('soldier_attack1', `${soldierPath}_Attack1-Sheet.png`, sf);
        this.load.spritesheet('soldier_attack2', `${soldierPath}_Attack2-Sheet.png`, sf);
        this.load.spritesheet('soldier_hurt',    `${soldierPath}_Hurt-Sheet.png`,    sf);
        this.load.spritesheet('soldier_death',   `${soldierPath}_Death-Sheet.png`,   sf);
        this.load.spritesheet('soldier_block',   `${soldierPath}_Block-Sheet.png`,   sf);

        // Tiled map — FinalGameMap.tmj with its 4 tilesets
        this.load.tilemapTiledJSON('map', 'assets/FinalGameMap.tmj');
        this.load.image('TileSet',            'assets/Map_Tileset/TileSet.png');
        this.load.image('Trees',              'assets/Map_Tileset/Trees.png');
        this.load.image('WaterTiles-6frames', 'assets/Map_Tileset/WaterTiles-6frames.png');
        this.load.image('Props',              'assets/Map_Tileset/Props.png');

        // Minotaur spritesheet — 128×96 per frame, 8 cols × 20 rows
        this.load.spritesheet('minotaur', 'assets/Enemies/Minotaur_Sprite_Sheet.png', { frameWidth: 128, frameHeight: 96 });

        // ── New enemies — all sprites 150×150 px per frame ──────────
        // 1200px wide = 8 frames | 600px wide = 4 frames
        const esf = { frameWidth: 150, frameHeight: 150 };

        // Flying Eye
        const fe = 'assets/Enemies/Flying eye/';
        this.load.spritesheet('eye_flight', fe + 'Flight.png',   esf); // 8fr
        this.load.spritesheet('eye_attack', fe + 'Attack.png',   esf); // 8fr
        this.load.spritesheet('eye_hit',    fe + 'Take Hit.png', esf); // 4fr
        this.load.spritesheet('eye_death',  fe + 'Death.png',    esf); // 4fr

        // Goblin
        const go = 'assets/Enemies/Goblin/';
        this.load.spritesheet('gob_run',    go + 'Run.png',      esf); // 8fr
        this.load.spritesheet('gob_attack', go + 'Attack.png',   esf); // 8fr
        this.load.spritesheet('gob_idle',   go + 'Idle.png',     esf); // 4fr
        this.load.spritesheet('gob_hit',    go + 'Take Hit.png', esf); // 4fr
        this.load.spritesheet('gob_death',  go + 'Death.png',    esf); // 4fr

        // Mushroom
        const mu = 'assets/Enemies/Mushroom/';
        this.load.spritesheet('mush_run',    mu + 'Run.png',      esf); // 8fr
        this.load.spritesheet('mush_attack', mu + 'Attack.png',   esf); // 8fr
        this.load.spritesheet('mush_idle',   mu + 'Idle.png',     esf); // 4fr
        this.load.spritesheet('mush_hit',    mu + 'Take Hit.png', esf); // 4fr
        this.load.spritesheet('mush_death',  mu + 'Death.png',    esf); // 4fr

        // Skeleton
        const sk = 'assets/Enemies/Skeleton/';
        this.load.spritesheet('skel_walk',   sk + 'Walk.png',     esf); // 4fr
        this.load.spritesheet('skel_attack', sk + 'Attack.png',   esf); // 8fr
        this.load.spritesheet('skel_idle',   sk + 'Idle.png',     esf); // 4fr
        this.load.spritesheet('skel_shield', sk + 'Shield.png',   esf); // 4fr
        this.load.spritesheet('skel_hit',    sk + 'Take Hit.png', esf); // 4fr
        this.load.spritesheet('skel_death',  sk + 'Death.png',    esf); // 4fr

        // All other enemy sprites are generated as colored shapes in makeFallbacks().
    }

    create() {
        // Load saved volume settings into the global registry so every scene can read them.
        // Defaults: music 50%, sfx 70%
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('survivorSettings')); } catch(e) {}
        this.game.registry.set('musicVolume', saved?.musicVolume ?? 0.5);
        this.game.registry.set('sfxVolume',   saved?.sfxVolume   ?? 0.7);

        // For any image that failed to load (file not in Assets/ yet),
        // generate a colored shape as a placeholder so the game still runs
        this.makeFallbacks();
        this.scene.start('titleScene');
    }

    // Displays a simple progress bar while assets load
    showLoadingBar() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        this.add.text(cx, cy - 50, 'Loading...', {
            fontSize: '22px', color: '#aaaacc'
        }).setOrigin(0.5);

        const barBg = this.add.rectangle(cx, cy, 400, 16, 0x222233);
        const bar   = this.add.rectangle(cx - 200, cy, 0, 16, 0x44ff88).setOrigin(0, 0.5);

        // Grow the bar as each file finishes loading (v = 0 → 1)
        this.load.on('progress', v => bar.setDisplaySize(400 * v, 16));
    }

    // Generates a colored-shape texture for each key that didn't load.
    // Replace these automatically by dropping the real PNG into Assets/.
    makeFallbacks() {
        const need = key => !this.textures.exists(key);

        // Soldier spritesheet fallbacks (single colored frame, 96×96)
        ['soldier_idle','soldier_walk','soldier_attack1','soldier_attack2','soldier_hurt','soldier_death','soldier_block'].forEach(key => {
            if (need(key)) {
                const g = this.make.graphics({ add: false });
                g.fillStyle(0x3388ff); g.fillRect(0, 0, 96, 96);
                g.fillStyle(0x66aaff); g.fillCircle(48, 36, 14);
                g.generateTexture(key, 96, 96); g.destroy();
            }
        });

        if (need('minotaur')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x8B0000); g.fillCircle(64, 48, 40);
            g.fillStyle(0xffffff, 0.2); g.fillCircle(50, 36, 12);
            g.generateTexture('minotaur', 128, 96); g.destroy();
        }

        // Enemy placeholder textures (colored circles, 48×48)
        const enemies = [
            ['enemy_rusher', 0xcc2222],
            ['enemy_shooter', 0x1144cc],
            ['enemy_arcer',   0x117733],
            ['enemy_boss',    0xff6600],
        ];
        enemies.forEach(([key, color]) => {
            if (need(key)) {
                const g = this.make.graphics({ add: false });
                g.fillStyle(color);     g.fillCircle(24, 24, 22);
                g.fillStyle(0xffffff, 0.25); g.fillCircle(18, 16, 8);
                g.generateTexture(key, 48, 48); g.destroy();
            }
        });


        if (need('xp_orb')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x88ff44); g.fillCircle(5, 5, 4);
            g.generateTexture('xp_orb', 10, 10); g.destroy();
        }

        if (need('death_pool')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x003311, 0.8); g.fillCircle(48, 48, 46);
            g.generateTexture('death_pool', 96, 96); g.destroy();
        }

    }
}
