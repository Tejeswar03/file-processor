// utils/WebSocket/index.js - Simplified for debugging
export const processAndUploadFile = async (
    file,
    signalingUrl = 'ws://localhost:3008', // Using ws:// protocol
    progressCallback
) => {
    console.log('Processing and uploading file:', file);
    if (!file) {
        throw new Error('No file provided');
    }

    if (progressCallback) progressCallback(5);

    try {
        await new Promise((resolve, reject) => {
            // Create WebSocket with proper protocol
            const ws = new WebSocket(signalingUrl);
            console.log('Attempting WebSocket connection to:', signalingUrl);
            
            ws.onopen = () => {
                console.log('WebSocket connection established');
                if (progressCallback) progressCallback(15);
                
                // Just send basic file info as a simple test
                try {
                    const message = JSON.stringify({ 
                        type: 'file_info',
                        filename: file.name,
                        fileSize: file.size,
                        fileType: file.type 
                    });
                    console.log('Sending message:', message);
                    ws.send(message);
                } catch (err) {
                    console.error('Error sending initial message:', err);
                    reject(new Error('Failed to send initial message'));
                }
            };

            ws.onmessage = ({ data }) => {
                console.log('Received WebSocket message:', typeof data === 'string' ? data : '[Binary data]');
                try {
                    // Just log received messages for debugging
                    if (typeof data === 'string') {
                        const response = JSON.parse(data);
                        console.log('Parsed response:', response);
                        
                        // If server acknowledges file info, upload directly via WebSocket
                        if (response.type === 'file_info_received') {
                            console.log('File info acknowledged, starting direct upload');
                            
                            // Read file and send in chunks
                            const reader = new FileReader();
                            reader.onload = () => {
                                const buffer = reader.result;
                                const chunkSize = 64 * 1024; // 64KB chunks
                                
                                // Send start upload message
                                ws.send(JSON.stringify({ type: 'upload_start' }));
                                
                                // Send chunks with progress updates
                                let offset = 0;
                                const total = buffer.byteLength;
                                
                                const sendNextChunk = () => {
                                    if (offset < total) {
                                        const chunk = buffer.slice(offset, Math.min(offset + chunkSize, total));
                                        ws.send(chunk);
                                        
                                        offset += chunkSize;
                                        
                                        if (progressCallback) {
                                            const pct = 15 + Math.round((offset / total) * 55);
                                            progressCallback(Math.min(pct, 70));
                                        }
                                        
                                        // Schedule next chunk (to avoid blocking UI)
                                        setTimeout(sendNextChunk, 0);
                                    } else {
                                        // Finished sending chunks
                                        ws.send(JSON.stringify({ type: 'upload_complete' }));
                                    }
                                };
                                
                                // Start sending chunks
                                sendNextChunk();
                            };
                            
                            reader.onerror = (err) => {
                                console.error('Error reading file:', err);
                                reject(new Error('File read error'));
                            };
                            
                            reader.readAsArrayBuffer(file);
                        }
                        
                        // Handle upload complete confirmation
                        if (response.type === 'upload_success') {
                            console.log('Upload completed successfully');
                            resolve();
                        }
                    }
                } catch (err) {
                    console.error('Error processing message:', err);
                }
            };

            ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                reject(new Error('WebSocket error: Connection failed'));
            };
            
            ws.onclose = (event) => {
                console.log(`WebSocket closed with code: ${event.code}, reason: ${event.reason}`);
                if (event.code !== 1000) {
                    // Not a normal closure
                    reject(new Error(`WebSocket closed abnormally. Code: ${event.code}`));
                }
            };

            // Add timeout for connection
            setTimeout(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    console.error('WebSocket connection timeout');
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });

        if (progressCallback) progressCallback(100);
        
        return { success: true, message: 'File uploaded successfully' };
    } catch (error) {
        console.error('File upload error:', error);
        
        // Fall back to HTTP upload
        console.log('WebSocket upload failed, trying HTTP fallback');
        try {
            const form = new FormData();
            form.append('file', file, file.name);
            const response = await fetch('http://localhost:3005/upload_websocket', {
                method: 'POST',
                body: form
            });

            if (!response.ok) {
                throw new Error(`HTTP upload failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (httpError) {
            console.error('HTTP fallback error:', httpError);
            throw error; // Throw the original WebSocket error
        }
    }
};

// For backward compatibility
export const socketUploadFile = processAndUploadFile;

// Export both functions
export default {
    processAndUploadFile,
    socketUploadFile
};