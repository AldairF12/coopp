import * as Phaser from 'phaser';

export default class Remote extends Phaser.Physics.Arcade.Sprite {
    // Añadimos spriteKey y animPrefix al constructor
    constructor(scene, x, y, spriteKey, animPrefix) {
        super(scene, x, y, spriteKey);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.animPrefix = animPrefix; // Guardamos si es p1_ o p2_

        // Ajustamos la caja de colisión EXACTAMENTE igual que en Player.js
        this.body.setSize(24, 48); 
        this.body.setOffset(45, 12); 
        
        this.setCollideWorldBounds(true);
        this.body.allowGravity = false; 
    }

    syncPosition(data) {
        // 1. Calculamos qué tan lejos está el fantasma de la posición real que dicta la red
        const distancia = Phaser.Math.Distance.Between(this.x, this.y, data.x, data.y);

        // 2. Si hubo un "lagazo" y la distancia es enorme (ej. más de 50px), teletransportamos para corregir
        if (distancia > 50) {
            this.setPosition(data.x, data.y);
        } else {
            // 3. LA MAGIA (LERP): Si la distancia es corta, lo deslizamos un 20% (0.2) hacia la posición real
            this.x = Phaser.Math.Linear(this.x, data.x, 0.2);
            this.y = Phaser.Math.Linear(this.y, data.y, 0.2);
        }

        // --- LÓGICA DE ANIMACIÓN REMOTA ---
        
        // 1. Lo volteamos si el otro jugador pulsó izquierda
        this.setFlipX(data.flipX);

        // 2. Reproducimos la animación correcta según los datos de la red
        if (!data.isGrounded) {
            this.anims.play(`${this.animPrefix}jump`, true); // Si no toca el suelo, salta
        } else if (Math.abs(data.vx) > 0.1) {
            this.anims.play(`${this.animPrefix}run`, true);  // Si tiene velocidad X, corre
        } else {
            this.anims.play(`${this.animPrefix}idle`, true); // Si está quieto, respira
        }
    }
}