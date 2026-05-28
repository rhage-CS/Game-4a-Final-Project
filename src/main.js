// main.js — Creates the Phaser game instance and sets up global config.
// All scenes are listed here in the order they are registered (not play order).
// Scene flow: Load → TitleScene → ClassSelect → GameScene → LevelUpScene → WinScene / DeathScene

const config = {
    type: Phaser.AUTO,      // let Phaser pick WebGL or Canvas automatically
    width: 1280,
    height: 720,
    parent: "phaser-game",  // the <div id="phaser-game"> in index.html
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,       // set to true to see hitboxes while testing
            gravity: { y: 0 }   // top-down game — no gravity
        }
    },
    pixelArt: false,
    backgroundColor: '#0a0a0f',
    scene: [Load, TitleScene, ClassSelect, GameScene, LevelUpScene, WinScene, DeathScene, SettingsScene]
};

const game = new Phaser.Game(config);
