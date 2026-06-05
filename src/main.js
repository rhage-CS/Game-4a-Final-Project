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
            debug: false,
            gravity: { y: 0 }
        }
    },
    pixelArt: false,
    transparent: true,      // canvas background is transparent — DOM elements show through
    scene: [Load, TitleScene, GameScene, LevelUpScene, WinScene, DeathScene, SettingsScene]
};

const game = new Phaser.Game(config);
