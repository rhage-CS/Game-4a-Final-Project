class Load extends Phaser.Scene {
    constructor() {
        super('loadScene');
    }

    preload() {
        this.showLoadingBar();

        // Tiled map — export from Tiled as JSON (.tmj) into Assets/
        // The tileset inside Tiled must be named exactly "tileset"
        this.load.tilemapTiledJSON('map',     'Assets/map.tmj');
        this.load.image('tileset',            'Assets/tileset.png');

        // Player sprites — one per class
        this.load.image('player1',       'Assets/character1.png');
        this.load.image('player2',       'Assets/character2.png');

        // Enemy sprites
        this.load.image('enemy_rusher',  'Assets/enemy_rusher.png');
        this.load.image('enemy_shooter', 'Assets/enemy_shooter.png');
        this.load.image('enemy_arcer',   'Assets/enemy_arcer.png');
        this.load.image('enemy_boss',    'Assets/boss.png');

        // Projectiles and pickups
        this.load.image('projectile',    'Assets/projectile.png');
        this.load.image('enemy_proj',    'Assets/enemy_projectile.png');
        this.load.image('xp_orb',        'Assets/xp_orb.png');
        this.load.image('death_pool',    'Assets/death_pool.png');

        // Fallback background tile (used when no Tiled map is loaded)
        this.load.image('bg_tile',       'Assets/bg_tile.png');

        // Music tracks
        this.load.audio('menu_music',   'Assets/menu_music.mp3');
        this.load.audio('game_music',   'Assets/game_music.mp3');
        this.load.audio('boss_music',   'Assets/boss_music.mp3'); // auto-swaps in at boss spawn

        // Sound effects
        this.load.audio('shoot',        'Assets/shoot.mp3');
        this.load.audio('hit',          'Assets/hit.mp3');
        this.load.audio('player_hurt',  'Assets/player_hurt.mp3');
        this.load.audio('xp_collect',   'Assets/xp_collect.mp3');
        this.load.audio('level_up',     'Assets/level_up.mp3');
        this.load.audio('enemy_death',  'Assets/enemy_death.mp3');
        this.load.audio('boss_death',   'Assets/boss_death.mp3');
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

        if (need('player1')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x3388ff); g.fillCircle(16, 16, 14);
            g.fillStyle(0x66aaff); g.fillCircle(12, 12, 5);
            g.generateTexture('player1', 32, 32); g.destroy();
        }

        if (need('player2')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0xaa33ff); g.fillCircle(16, 16, 14);
            g.fillStyle(0xcc77ff); g.fillCircle(12, 12, 5);
            g.generateTexture('player2', 32, 32); g.destroy();
        }

        if (need('enemy_rusher')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0xcc2222); g.fillCircle(16, 16, 14);
            g.fillStyle(0xff4444, 0.6); g.fillCircle(16, 16, 10);
            g.generateTexture('enemy_rusher', 32, 32); g.destroy();
        }

        if (need('enemy_shooter')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x1144aa); g.fillCircle(14, 14, 12);
            g.fillStyle(0x3377dd, 0.6); g.fillCircle(14, 14, 7);
            g.generateTexture('enemy_shooter', 28, 28); g.destroy();
        }

        if (need('enemy_arcer')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x117733); g.fillCircle(14, 14, 12);
            g.fillStyle(0x44cc66, 0.6); g.fillCircle(14, 14, 7);
            g.generateTexture('enemy_arcer', 28, 28); g.destroy();
        }

        if (need('enemy_boss')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0xff6600); g.fillCircle(36, 36, 34);
            g.fillStyle(0xffaa00, 0.5); g.fillCircle(36, 36, 22);
            g.fillStyle(0xffdd00, 0.3); g.fillCircle(36, 36, 12);
            g.generateTexture('enemy_boss', 72, 72); g.destroy();
        }

        if (need('projectile')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x88ddff); g.fillCircle(6, 6, 5);
            g.generateTexture('projectile', 12, 12); g.destroy();
        }

        if (need('enemy_proj')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0xff5500); g.fillCircle(6, 6, 5);
            g.generateTexture('enemy_proj', 12, 12); g.destroy();
        }

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

        if (need('bg_tile')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x111122); g.fillRect(0, 0, 64, 64);
            g.lineStyle(1, 0x1e1e33, 1); g.strokeRect(0, 0, 64, 64);
            g.generateTexture('bg_tile', 64, 64); g.destroy();
        }
    }
}
