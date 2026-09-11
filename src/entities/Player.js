import * as Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, spriteKey, animPrefix) {
        super(scene, x, y, spriteKey);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.animPrefix = animPrefix; // Guardamos el prefijo (p1_ o p2_)

        // LA CAJA FÍSICA (Hitbox)
        // Aunque la imagen es de 114x64, la caja que choca será de 24x48 para caber por huecos
        this.body.setSize(24, 48); 
        // Movemos la caja al centro de los 114 píxeles de ancho
        this.body.setOffset(45, 12); 
        
        this.setBounce(0.1);            
        this.setCollideWorldBounds(true);

        this.cursors = scene.input.keyboard.createCursorKeys();
        
        this.speed = 200;
        this.jumpVelocity = -250; 

        // Variables para los controles táctiles
        this.mobileInput = { left: false, right: false, jump: false };
        this.setupMobileControls();
    }

    setupMobileControls() {
        // Enlazamos los botones HTML con nuestras variables usando touchstart/touchend
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');

        if(btnLeft && btnRight && btnJump) {
            // Izquierda
            btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput.left = true; });
            btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput.left = false; });
            
            // Derecha
            btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput.right = true; });
            btnRight.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput.right = false; });
            
            // Salto
            btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); this.mobileInput.jump = true; });
            btnJump.addEventListener('touchend', (e) => { e.preventDefault(); this.mobileInput.jump = false; });
        }
    }

    update() {
        // Combinamos la lectura: Teclado O Botón Táctil
        const isLeftDown = this.cursors.left.isDown || this.mobileInput.left;
        const isRightDown = this.cursors.right.isDown || this.mobileInput.right;
        const isJumpDown = this.cursors.up.isDown || this.mobileInput.jump;

        // Lógica de Movimiento y Animación
        if (isLeftDown) {
            this.setVelocityX(-this.speed);
            this.setFlipX(true); // Voltea la imagen para mirar a la izquierda
            if (this.body.blocked.down) this.anims.play(`${this.animPrefix}run`, true);
        } else if (isRightDown) {
            this.setVelocityX(this.speed);
            this.setFlipX(false); // Mira a la derecha
            if (this.body.blocked.down) this.anims.play(`${this.animPrefix}run`, true);
        } else {
            this.setVelocityX(0); 
            if (this.body.blocked.down) this.anims.play(`${this.animPrefix}idle`, true);
        }

        // Salto (Sobrescribe la animación de correr/idle si está en el aire)
        if (isJumpDown && this.body.blocked.down) {
            this.setVelocityY(this.jumpVelocity);
        }

        if (!this.body.blocked.down) {
            this.anims.play(`${this.animPrefix}jump`, true);
        }
    }
}