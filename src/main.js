import * as Phaser from 'phaser';
import Player from './entities/Player.js';
import Remote from './entities/Remote.js'; // Importamos el fantasma
import WebRTCManager from './network/WebRTC.js';

const SERVER_IP = 'https://coop-platformer-server.onrender.com'; //192.168.45.102:3000
let network;

// --- ESCENA DE PHASER ---
class PlayScene extends Phaser.Scene {
    constructor() {
        super('PlayScene');
    }

    preload() {
        this.load.image('tiles', 'assets/images/terrain.png');
        this.load.tilemapTiledJSON('mapa', 'assets/tilemaps/level1.json');
        this.load.spritesheet('jugador1', '../src/assets/images/p1_spritesheet.png', { frameWidth: 114, frameHeight: 64 });
        this.load.spritesheet('jugador2', '../src/assets/images/p2_spritesheet.png', { frameWidth: 114, frameHeight: 64 });
        this.load.image('fondo', '../src/assets/images/background_neon0.png');
    }

    create() {
        // 1. Añadimos el fondo en el centro exacto de tu resolución (800x600)
        this.add.image(400, 300, 'fondo');

        // -- DEFINICIÓN DE ANIMACIONES PARA JUGADOR 1 --
        // Fila 1 (Inactivo): Cuadros del 0 al 6
        this.anims.create({
            key: 'p1_idle',
            frames: this.anims.generateFrameNumbers('jugador1', { start: 0, end: 6 }),
            frameRate: 10,
            repeat: -1 // -1 significa que se repite en bucle infinito
        });

        // Fila 2 (Correr): Cuadros del 7 al 13
        this.anims.create({
            key: 'p1_run',
            frames: this.anims.generateFrameNumbers('jugador1', { start: 7, end: 13 }),
            frameRate: 15,
            repeat: -1
        });

        // Fila 3 (Saltar): Cuadros del 14 al 20
        this.anims.create({
            key: 'p1_jump',
            frames: this.anims.generateFrameNumbers('jugador1', { start: 14, end: 20 }),
            frameRate: 10,
            repeat: 0 // El salto solo se reproduce una vez en el aire
        });

        // -- DEFINICIÓN DE ANIMACIONES PARA JUGADOR 2 --
        // Fila 1 (Inactivo): Cuadros del 0 al 6
        this.anims.create({
            key: 'p2_idle',
            frames: this.anims.generateFrameNumbers('jugador2', { start: 0, end: 6 }),
            frameRate: 10,
            repeat: -1
        });

        // Fila 2 (Correr): Cuadros del 7 al 13
        this.anims.create({
            key: 'p2_run',
            frames: this.anims.generateFrameNumbers('jugador2', { start: 7, end: 13 }),
            frameRate: 15,
            repeat: -1
        });

        // Fila 3 (Saltar): Cuadros del 14 al 20
        this.anims.create({
            key: 'p2_jump',
            frames: this.anims.generateFrameNumbers('jugador2', { start: 14, end: 20 }),
            frameRate: 10,
            repeat: 0
        });


        // Creamos una textura blanca de 32x32 dinámicamente
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xffffff);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('cuadrado', 32, 32);


        const map = this.make.tilemap({ key: 'mapa' });
        const tileset = map.addTilesetImage('terrain_tiles', 'tiles');
        
        // Guardamos la capa en 'this' para poder usarla luego
        this.plataformasLayer = map.createLayer('Plataformas', tileset, 0, 0);
        this.plataformasLayer.setCollisionByExclusion([-1]);
        
        // ¡OJO! Ya no creamos a los jugadores aquí. 
        // El mapa se quedará vacío esperando la conexión P2P.
    }

    // Esta función la llamará la red cuando el "apretón de manos" termine
    onNetworkConnected(isHost) {
        // Asignamos colores: Host = Rojo (Fireboy), Invitado = Azul (Watergirl)
        // Si soy Host, aparezco a la izquierda. Si soy invitado, a la derecha.
        // const spawnX = isHost ? 100 : 120;
        // const myColor = isHost ? 0xff0000 : 0x0044ff;
        // const remoteColor = isHost ? 0x0044ff : 0xff0000;
        const spawnX = isHost ? 100 : 120;
        
        // Asignamos el sprite y el prefijo de animación según quién somos
        const mySprite = isHost ? 'jugador1' : 'jugador2';
        const myAnim = isHost ? 'p1_' : 'p2_';

        const remoteSprite = isHost ? 'jugador2' : 'jugador1';
        const remoteAnim = isHost ? 'p2_' : 'p1_';

        this.localPlayer = new Player(this, spawnX, 150, mySprite, myAnim);
        this.remotePlayer = new Remote(this, 0, 0, remoteSprite, remoteAnim);

        // Soltamos a los jugadores en el mapa
        //this.localPlayer = new Player(this, spawnX, 150, myColor);
        // El remoto aparecerá donde el otro jugador diga que está, así que lo creamos en (0,0) y lo moveremos por red
        //this.remotePlayer = new Remote(this, 0, 0, remoteColor); // El invitado nace un poco más a la derecha

        this.physics.add.collider(this.localPlayer, this.plataformasLayer);
        this.physics.add.collider(this.remotePlayer, this.plataformasLayer);

        // Guardamos el rol en la escena para usarlo en el update
        this.isHost = isHost;

        // 1. CREAMOS LA PUERTA (Rectángulo Verde, estático)
        // NOTA: Cambia el 400 y 200 por las coordenadas X e Y donde quieras tu puerta
        this.puerta = this.add.rectangle(400, 200, 32, 64, 0x00ff00);
        this.physics.add.existing(this.puerta, true); // 'true' la hace inamovible (estática)
        
        // Guardamos los colliders para poder desactivarlos cuando se abra
        this.colliderPuertaLocal = this.physics.add.collider(this.localPlayer, this.puerta);
        this.colliderPuertaRemoto = this.physics.add.collider(this.remotePlayer, this.puerta);

        // 2. CREAMOS EL BOTÓN (Rectángulo Amarillo, en el suelo)
        // NOTA: Cambia el 250 y 250 por coordenadas donde haya piso en tu mapa
        this.boton = this.add.rectangle(210, 290, 40, 10, 0xffff00);
        this.physics.add.existing(this.boton, true);
        
        // Variable para recordar el estado del botón y no enviar mensajes a lo loco
        this.isBotonPisado = false;
        
        this.cameras.main.startFollow(this.localPlayer);
    }

    abrirPuerta(abierta) {
        if (abierta) {
            this.puerta.setFillStyle(0x005500); // Se vuelve verde oscuro
            this.puerta.setAlpha(0.5);          // Se hace semitransparente
            this.colliderPuertaLocal.active = false; // Desactivamos el choque
            this.colliderPuertaRemoto.active = false;
        } else {
            this.puerta.setFillStyle(0x00ff00); // Verde brillante
            this.puerta.setAlpha(1);            // Sólida de nuevo
            this.colliderPuertaLocal.active = true;  // Activamos el choque
            this.colliderPuertaRemoto.active = true;
        }
    }

    update() {
        // Solo actualizamos y enviamos datos si nuestro jugador local ya fue creado
        if (this.localPlayer) {
            this.localPlayer.update();
            
            // Bombardeamos la red con nuestra posición actual Y nuestro estado visual
            network.sendData({
                tipo: 'sync',
                x: this.localPlayer.x,
                y: this.localPlayer.y,
                vx: this.localPlayer.body.velocity.x,
                vy: this.localPlayer.body.velocity.y,
                flipX: this.localPlayer.flipX, // NUEVO: ¿Hacia dónde miramos? (true/false)
                isGrounded: this.localPlayer.body.blocked.down // NUEVO: ¿Estamos tocando el suelo?
            });

            // --- LÓGICA COOPERATIVA (SOLO EL HOST PIENSA) ---
            if (this.isHost) {
                // Verificamos si alguno de los dos está tocando (overlap) el botón
                const tocaLocal = this.physics.overlap(this.localPlayer, this.boton);
                const tocaRemoto = this.physics.overlap(this.remotePlayer, this.boton);
                const alguienPisa = tocaLocal || tocaRemoto;

                // Si el estado del botón cambió respecto al frame anterior...
                if (alguienPisa !== this.isBotonPisado) {
                    this.isBotonPisado = alguienPisa; // Actualizamos la memoria
                    
                    this.abrirPuerta(this.isBotonPisado); // Lo abrimos en nuestra pantalla
                    
                    // Le ordenamos al invitado que haga lo mismo
                    network.sendData({ 
                        tipo: 'puerta', 
                        abierta: this.isBotonPisado 
                    });
                }
            }
        }
    }

    // Esta función la llama la red cuando llega un paquete del otro jugador
    syncRemotePlayer(data) {
        if (this.remotePlayer) {
            this.remotePlayer.syncPosition(data);
        }
    }
}

// --- CONFIGURACIÓN DE PHASER ---
const config = {
    type: Phaser.AUTO,
    backgroundColor: '#000f18',//#2d2d2d
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT, // Ajusta el juego al tamaño de la ventana
        autoCenter: Phaser.Scale.CENTER_BOTH, // Lo centra siempre
        width: 800, // Nuestra resolución base
        height: 600
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 300 }, debug: true }
    },
    scene: [PlayScene]
};

const game = new Phaser.Game(config);

// --- LÓGICA DE RED Y MENÚ ---
function initNetwork() {
    // --- LECTURA AUTOMÁTICA DE ENLACES ---
    // Revisamos si la URL tiene un parámetro llamado "sala"
    const urlParams = new URLSearchParams(window.location.search);
    const salaDesdeUrl = urlParams.get('sala');

    if (salaDesdeUrl) {
        // Si hay una sala en el link, la ponemos automáticamente en el input
        document.getElementById('input-room').value = salaDesdeUrl;
        document.getElementById('status-text').innerText = "Invitación detectada. Haz clic en Unirse.";
        // Opcional: Ocultamos el botón de crear para no confundir al invitado
        document.getElementById('btn-create').style.display = 'none'; 
    }
    // -------------------------------------

    network = new WebRTCManager(
        SERVER_IP, 
        () => {
            console.log("¡CONEXIÓN P2P ESTABLECIDA! Lanzando personajes...");
            // Obtenemos la escena actual de Phaser y le damos la orden de crear los personajes
            const playScene = game.scene.getScene('PlayScene');
            playScene.onNetworkConnected(network.isHost);
        },
        (datos) => {
            const playScene = game.scene.getScene('PlayScene');
            if (!playScene) return;

            if (datos.tipo === 'sync') {
                playScene.syncRemotePlayer(datos);
            } 
            // NUEVO: Escuchamos las órdenes del Host sobre la puerta
            else if (datos.tipo === 'puerta') {
                playScene.abrirPuerta(datos.abierta);
            }
        }
    );

    document.getElementById('btn-create').addEventListener('click', () => network.createRoom());
    document.getElementById('btn-join').addEventListener('click', () => {
        const code = document.getElementById('input-room').value;
        if(code) network.joinRoom(code);
    });
}

initNetwork();