// Fix 1: Align the function names between implementation and usage
// Change the export to match how it's being called in handleWebSocket

// utils/WebSocket/index.js
export const processAndUploadFile = async (
    file,
    signalingUrl = 'ws://localhost:3002',
    progressCallback
) => {
    console.log('Processing and uploading file:', file);
    if (!file) {
        throw new Error('No file provided');
    }

    if (progressCallback) progressCallback(5);

    try {
        await new Promise((resolve, reject) => {
            const ws = new WebSocket(signalingUrl);
            let pc;
            let channel;

            ws.onopen = () => {
                if (progressCallback) progressCallback(15);
                pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                channel = pc.createDataChannel('fileUpload');
                setupChannelEvents(channel, file, progressCallback, resolve, reject);

                pc.onicecandidate = ({ candidate }) => {
                    if (candidate) {
                        ws.send(JSON.stringify({ type: 'candidate', candidate }));
                    }
                };

                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .then(() => ws.send(JSON.stringify({ type: 'offer', offer: pc.localDescription })))
                    .catch(err => reject(new Error('Offer error: ' + err.message)));
            };

            ws.onmessage = async ({ data }) => {
                const msg = JSON.parse(data);
                try {
                    if (msg.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
                    } else if (msg.type === 'candidate') {
                        await pc.addIceCandidate(msg.candidate);
                    }
                } catch (err) {
                    console.error('Signaling error:', err);
                    reject(new Error('Signaling error: ' + err.message));
                }
            };

            ws.onerror = err => reject(new Error('WebSocket error: ' + err.message));
            ws.onclose = () => console.log('WebSocket closed');

            // Add timeout for connection
            setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });

        if (progressCallback) progressCallback(70);

        // HTTP fallback upload
        const form = new FormData();
        form.append('file', file, file.name);
        const response = await fetch('http://localhost:3002/upload_websocket', {
            method: 'POST',
            body: form
        });

        if (!response.ok) {
            throw new Error(`HTTP upload failed: ${response.statusText}`);
        }

        if (progressCallback) progressCallback(100);

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('File upload error:', error);
        throw error; // Re-throw to be handled by the UI
    }
};

function setupChannelEvents(channel, file, progressCallback, resolve, reject) {
    channel.onopen = () => {
        readFileAndSend(channel, file, progressCallback)
            .then(() => {
                channel.send(JSON.stringify({ done: true }));
                resolve();
            })
            .catch(err => reject(err));
    };
    channel.onerror = err => reject(new Error('DataChannel error: ' + err.message));
    channel.onclose = () => console.log('DataChannel closed');
}

function readFileAndSend(channel, file, progressCallback) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const buffer = reader.result;
            const total = buffer.byteLength;
            const chunkSize = 16 * 1024;
            let offset = 0;
            try {
                while (offset < total) {
                    const slice = buffer.slice(offset, offset + chunkSize);
                    channel.send(slice);
                    offset += chunkSize;
                    if (progressCallback) {
                        const pct = 15 + Math.round((offset / total) * 55);
                        progressCallback(Math.min(pct, 70));
                    }
                }
                resolve();
            } catch (err) {
                reject(new Error('Error sending data: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.onprogress = e => {
            if (e.lengthComputable && progressCallback) {
                const pct = 15 + Math.round((e.loaded / e.total) * 40);
                progressCallback(pct);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// For backward compatibility
export const socketUploadFile = processAndUploadFile;

// Export both functions
export default {
    processAndUploadFile,
    socketUploadFile
};