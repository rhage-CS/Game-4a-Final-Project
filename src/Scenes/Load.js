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
        this.load.image('Trees_seperated',    'assets/Map_Tileset/Trees_seperated.png');

        // ── New enemies — all sprites 150×150 px per frame ──────────
        // 1200px wide = 8 frames | 600px wide = 4 frames
        // ── Effect spritesheets (Effects:Spells folder) ──────────────
        const efxPath = 'assets/Effects:Spells/';
        this.load.spritesheet('efx_lightning',  efxPath + 'LightingAttack.png',              { frameWidth: 64, frameHeight: 64 }); // 7fr
        this.load.spritesheet('efx_fire_hit',   efxPath + 'Spritesheet_Fire.png',            { frameWidth: 32, frameHeight: 32 }); // 10fr
        this.load.spritesheet('efx_dmg',       efxPath + 'spritesheet_Dmg.png',             { frameWidth: 64, frameHeight: 64 }); // 18fr
        this.load.spritesheet('efx_defense',   efxPath + 'spritesheet_Defense.png',         { frameWidth: 64, frameHeight: 64 }); // 18fr
        this.load.spritesheet('efx_poison',    efxPath + 'spritesheet_Posion.png',          { frameWidth: 64, frameHeight: 64 }); // 17fr
        this.load.spritesheet('efx_aoe',       efxPath + 'spritesheet_AOE.png',             { frameWidth: 64, frameHeight: 64 }); // 17fr
        this.load.spritesheet('efx_music',     efxPath + 'spritesheet_Music.png',           { frameWidth: 64, frameHeight: 64 }); // 21fr
        this.load.spritesheet('efx_exp_base',  efxPath + 'spritesheet_Explosion_Base.png',  { frameWidth: 48, frameHeight: 48 }); // 10fr
        this.load.spritesheet('efx_exp_fire',  efxPath + 'spritesheet_Explosion_Fire.png',  { frameWidth: 64, frameHeight: 48 }); // 14fr
        this.load.spritesheet('efx_exp_magic', efxPath + 'spritesheet_Explosion_Magic.png', { frameWidth: 48, frameHeight: 48 }); // 10fr

        // ── Augment / stat icon images (Icons folder) ─────────────
        const ic = 'assets/Icons/';
        this.load.image('icon_attack',        ic + 'Attack.png');
        this.load.image('icon_strength',      ic + 'Strength_Up.png');
        this.load.image('icon_movespeed',     ic + 'MovementSpeed_Up.png');
        this.load.image('icon_atkspeed',      ic + 'Attack_Speed_Up.png');
        this.load.image('icon_atkrange',      ic + 'AttacRange_Up.png');
        this.load.image('icon_pickuprange',   ic + 'Pickup_Range_Up.png');
        this.load.image('icon_hp_regen',      ic + 'HP_Regen.png');
        this.load.image('icon_cooldown',      ic + 'Cooldown_Reduction.png');
        this.load.image('icon_defense',       ic + 'Defense_Up.png');
        this.load.image('icon_shield',        ic + 'Shield.png');
        this.load.image('icon_bomb',          ic + 'Bomb.png');
        this.load.image('icon_chain',         ic + 'Chain.png');
        this.load.image('icon_cloak',         ic + 'Cloak.png');
        this.load.image('icon_deathpool',     ic + 'Death_Pool.png');
        this.load.image('icon_doublestrike',  ic + 'Double_Strike.png');
        this.load.image('icon_fire',          ic + 'Fire.png');
        this.load.image('icon_freeze',        ic + 'Freeze.png');
        this.load.image('icon_aura',          ic + 'Aura.png');
        this.load.image('icon_lucky',         ic + 'Lucky.png');
        this.load.image('icon_music',         ic + 'Music.png');
        this.load.image('icon_overkill',      ic + 'OverKill.png');
        this.load.image('icon_lightning',     ic + 'LightingStrike.png');

        // XP orb tiers
        this.load.image('xp_base',     'assets/Icons/BaseXP.png');
        this.load.image('xp_uncommon', 'assets/Icons/UncommonXP.png');
        this.load.image('xp_rare',     'assets/Icons/RareXP.png');
        this.load.image('icon_maxhealth',     ic + 'Max_Health.png');
        this.load.image('icon_extrashot',     ic + 'Extra_Shot.png');
        this.load.image('icon_omnivamp',      ic + 'OmniVamp.png');
        this.load.image('icon_proliferate',   ic + 'Proliferate.png');

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
            fontFamily: 'Arial', fontSize: '22px', color: '#aaaacc'
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


        // XP orb fallbacks (32×32 coloured circles)
        if (need('xp_base'))     { const g = this.make.graphics({ add: false }); g.fillStyle(0x44ff88); g.fillCircle(16,16,14); g.generateTexture('xp_base',     32, 32); g.destroy(); }
        if (need('xp_uncommon')) { const g = this.make.graphics({ add: false }); g.fillStyle(0x44aaff); g.fillCircle(16,16,14); g.generateTexture('xp_uncommon', 32, 32); g.destroy(); }
        if (need('xp_rare'))     { const g = this.make.graphics({ add: false }); g.fillStyle(0xff66ff); g.fillCircle(16,16,14); g.generateTexture('xp_rare',     32, 32); g.destroy(); }

        if (need('death_pool')) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x003311, 0.8); g.fillCircle(48, 48, 46);
            g.generateTexture('death_pool', 96, 96); g.destroy();
        }

    }
}
