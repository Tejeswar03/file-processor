// utils/WebSocket/index.js
// Fixed to match server's expected format

// Main upload function
const processAndUploadFile = async (
    file,
    signalingUrl = 'ws://localhost:3002/upload_websocket',
    progressCallback
) => {
    console.log('Processing and uploading file via WebSocket:', file.name);
    
    if (!file) {
        throw new Error('No file provided');
    }

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(signalingUrl);
        
        // Set up connection timeout
        const connectionTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                reject(new Error('WebSocket connection timeout'));
            }
        }, 10000);
        
        ws.onopen = function() {
            console.log("WebSocket connection opened");
            clearTimeout(connectionTimeout);
            
            if (progressCallback) progressCallback(10);
            
            // Send the file using the format your server expects
            sendFile();
        };
        
        ws.onmessage = function(event) {
            console.log("Message from server:", event.data);
            
            // Try to parse as JSON first
            try {
                const data = JSON.parse(event.data);
                if (progressCallback) progressCallback(100);
                resolve(data);
            } catch (err) {
                // Not JSON, treat as a string message
                if (event.data.includes('Error')) {
                    reject(new Error(event.data));
                } else {
                    // Treat as progress or other info
                    if (progressCallback) progressCallback(50);
                    // If this is a completion message, resolve
                    if (event.data.includes('success') || event.data.includes('complete')) {
                        resolve({ success: true, message: event.data });
                    }
                }
            }
        };
        
        ws.onclose = function(event) {
            console.log("WebSocket connection closed", event.code, event.reason);
            clearTimeout(connectionTimeout);
            
            // If connection closed without resolving or rejecting
            if (event.code !== 1000 && event.code !== 1001) {
                reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
            }
        };
        
        ws.onerror = function(error) {
            console.error("WebSocket error:", error);
            clearTimeout(connectionTimeout);
            reject(error);
        };
        
        // Helper function to send file in the format the server expects
        function sendFile() {
            const reader = new FileReader();
            reader.onload = function() {
                try {
                    // Format: "filename:::base64data"
                    const base64Data = reader.result.split(',')[1]; // remove data URI prefix
                    const message = `${file.name}:::${base64Data}`;
                    ws.send(message);
                    
                    if (progressCallback) progressCallback(30);
                } catch (err) {
                    console.error('Error sending file:', err);
                    reject(new Error('Failed to send file: ' + err.message));
                }
            };
            reader.onerror = function(error) {
                reject(new Error('Error reading file: ' + error));
            };
            reader.readAsDataURL(file);
        }
    });
};

// Create the socketUploadFile object
const socketUploadFile = {
    processAndUploadFile: processAndUploadFile
};

// Expose to window for global access
if (typeof window !== 'undefined') {
    window.socketUploadFile = socketUploadFile;
    console.log('Socket Handler module loaded successfully');
}

// Export for module imports
export { processAndUploadFile, socketUploadFile };

// Default export
export default socketUploadFile;