const DEFAULT_CHUNK_SIZE = 120 * 1024;

const processAndUploadFile = async (
    file,
    signalingUrl = 'wss://linkanaccount.com:8443/upload_websocket',
    progressCallback,
    chunkSize = DEFAULT_CHUNK_SIZE
) => {
    console.log('Processing and uploading file via WebSocket in chunks:', file.name);
    
    if (!file) {
        throw new Error('No file provided');
    }

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(signalingUrl);
        let chunkNumber = 0;
        let offset = 0;
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }
        }, 10000);
        
        ws.onopen = function() {
            console.log("WebSocket connection opened");
            clearTimeout(connectionTimeout);
            
            if (progressCallback) progressCallback(5);
            
            sendNextChunk();
        };
        
        ws.onmessage = function(event) {
            console.log("Message from server:", event.data);
            
            try {
                const data = JSON.parse(event.data);
                
                if (data.chunkReceived && chunkNumber < totalChunks) {
                    const progress = Math.min(95, Math.floor((chunkNumber / totalChunks) * 90) + 5);
                    if (progressCallback) progressCallback(progress);
                    
                    if (offset < file.size) {
                        sendNextChunk();
                    }
                } else if (data.uploadComplete || data.success) {
                    if (progressCallback) progressCallback(100);
                    resolve(data);
                } else {
                    console.log("Server message:", data);
                }
            } catch (err) {
                if (event.data.includes('Error')) {
                    reject(new Error(event.data));
                } else if (event.data.includes('next')) {
                    if (offset < file.size) {
                        const progress = Math.min(95, Math.floor((chunkNumber / totalChunks) * 90) + 5);
                        if (progressCallback) progressCallback(progress);
                        sendNextChunk();
                    }
                } else if (event.data.includes('success') || event.data.includes('complete')) {
                    if (progressCallback) progressCallback(100);
                    resolve({ success: true, message: event.data });
                }
            }
        };
        
        ws.onclose = function(event) {
            console.log("WebSocket connection closed", event.code, event.reason);
            clearTimeout(connectionTimeout);
            
            if (event.code !== 1000 && event.code !== 1001) {
                reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
            }
        };
        
        ws.onerror = function(error) {
            console.error("WebSocket error:", error);
            clearTimeout(connectionTimeout);
            reject(error);
        };
        
        function sendNextChunk() {
            if (offset >= file.size) {
                console.log("All chunks sent");
                return;
            }
            
            const slice = file.slice(offset, offset + chunkSize);
            const reader = new FileReader();
            
            reader.onload = function() {
                try {
                    const base64Data = reader.result.split(',')[1];
                    const isLast = (offset + chunkSize >= file.size) ? "1" : "0";
                    const message = `${file.name}:::${chunkNumber}:::${isLast}:::${base64Data}`;
                    ws.send(message);
                    
                    offset += chunkSize;
                    chunkNumber++;
                } catch (err) {
                    console.error('Error sending chunk:', err);
                    reject(new Error('Failed to send chunk: ' + err.message));
                }
            };
            
            reader.onerror = function(error) {
                reject(new Error('Error reading file chunk: ' + error));
            };
            
            reader.readAsDataURL(slice);
        }
    });
};

const socketUploadFile = {
    processAndUploadFile: processAndUploadFile
};

if (typeof window !== 'undefined') {
    window.socketUploadFile = socketUploadFile;
    console.log('Chunked Socket Handler module loaded successfully');
}

export { processAndUploadFile, socketUploadFile };

export default socketUploadFile;
