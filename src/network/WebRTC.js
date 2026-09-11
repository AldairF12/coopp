import { io } from 'socket.io-client';

export default class WebRTCManager {
    constructor(serverIp, onConnected, onMessageReceived) {
        this.socket = io(serverIp);
        this.peerConnection = null;
        this.dataChannel = null;
        this.isHost = false;
        this.remoteId = null; // ¡LA PIEZA QUE FALTABA!
        
        this.onConnected = onConnected;
        this.onMessageReceived = onMessageReceived;

        this.config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        this.socket.on('roomCreated', (roomId) => {
            this.isHost = true;
            document.getElementById('status-text').innerText = `Sala creada. Código: ${roomId} \nEsperando jugador 2...`;

            // --- LÓGICA DE INVITACIÓN RÁPIDA ---
            // Creamos la URL actual sumando el parámetro ?sala=ABCD
            const inviteUrl = `${window.location.origin}${window.location.pathname}?sala=${roomId}`;
            
            // Seleccionamos los elementos del DOM
            const qrImg = document.getElementById('qr-code');
            const shareInput = document.getElementById('share-link');
            const inviteSection = document.getElementById('invite-section');
            const actionButtons = document.getElementById('action-buttons');
            
            if(qrImg && shareInput && inviteSection && actionButtons) {
                console.log("🔗 Generando código QR para la invitación...");
                // Usamos una API gratuita para generar el QR basado en la URL
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(inviteUrl)}`;
                shareInput.value = inviteUrl; // Llenamos la caja de texto con el link
                
                // Cambiamos lo que se ve en el menú
                actionButtons.style.display = 'none'; // Ocultamos los botones iniciales
                inviteSection.style.display = 'block'; // Mostramos el QR
            }
            
            console.log("🏠 Eres el Host. Esperando invitado...");
        });

        this.socket.on('roomJoined', (roomId) => {
            this.isHost = false;
            document.getElementById('status-text').innerText = `Unido a la sala ${roomId}. Conectando P2P...`;
            console.log("🤝 Te uniste a la sala. Esperando oferta del Host...");
        });

        // Cuando el invitado entra, el Host recibe su ID y arranca el proceso
        this.socket.on('guestJoined', async (guestId) => {
            console.log(`👤 Invitado detectado (ID: ${guestId}). Creando conexión P2P...`);
            this.remoteId = guestId; // Guardamos a quién enviarle los datos
            
            this.createPeerConnection();
            this.dataChannel = this.peerConnection.createDataChannel('gameData');
            this.setupDataChannel();

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            console.log("📡 Enviando Oferta WebRTC al invitado...");
            this.socket.emit('signal', { to: this.remoteId, signal: { type: 'offer', sdp: offer } });
        });

        this.socket.on('signal', async (data) => {
            if (!this.peerConnection) this.createPeerConnection();
            
            // Si somos el invitado, guardamos el ID del Host para poder responderle
            if (!this.remoteId) this.remoteId = data.from;

            const signal = data.signal;
            
            if (signal.type === 'offer') {
                console.log("📥 Oferta recibida. Creando y enviando Respuesta...");
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                this.socket.emit('signal', { to: this.remoteId, signal: { type: 'answer', sdp: answer } });
            
            } else if (signal.type === 'answer') {
                console.log("📥 Respuesta recibida. Estableciendo conexión final...");
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            
            } else if (signal.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        });
    }

    createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.config);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('signal', { to: this.remoteId, signal: { candidate: event.candidate } });
            }
        };

        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log("⚡ ¡Canal de datos abierto y listo!");
            document.getElementById('ui-layer').style.display = 'none'; // Ocultamos toda la UI
            this.onConnected(); 
        };
        this.dataChannel.onmessage = (event) => {
            this.onMessageReceived(JSON.parse(event.data));
        };
    }

    createRoom() {
        const id = Math.random().toString(36).substring(2, 6).toUpperCase();
        this.socket.emit('createRoom', id);
    }

    joinRoom(id) {
        this.socket.emit('joinRoom', id.toUpperCase());
    }

    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(data));
        }
    }
}