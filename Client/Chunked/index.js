function generateFileId(filename) {
    const str = `${filename}_${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

async function prepareFileForChunking(file, chunkSize = 1024 * 1024) {
    return new Promise((resolve) => {
        const totalSize = file.size;
        const totalChunks = Math.ceil(totalSize / chunkSize);
        const fileId = generateFileId(file.name);
        resolve({
            totalChunks,
            fileId
        });
    });
}

function convertChunkToBase64(file, start, end) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            let binary = '';
            const bytes = new Uint8Array(arrayBuffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Error reading file chunk'));
        const blob = file.slice(start, end);
        reader.readAsArrayBuffer(blob);
    });
}

async function sendChunk(serverUrl, base64Chunk, filename, chunkIndex, totalChunks, fileId) {
    try {
        const payload = {
            filename,
            fileId,
            chunkIndex,
            totalChunks,
            chunkData: base64Chunk,
            timestamp: new Date().toISOString()
        };
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        throw new Error(`Error sending chunk ${chunkIndex}: ${error.message}`);
    }
}

async function uploadFileInChunks(file, serverUrl, chunkSize = 1024 * 1024, progressCallback = null) {
    try {
        const filename = file.name;
        const { totalChunks, fileId } = await prepareFileForChunking(file, chunkSize);
        let lastResponse = null;
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            if (progressCallback && typeof progressCallback === 'function') {
                progressCallback({
                    filename,
                    fileId,
                    currentChunk: i + 1,
                    totalChunks,
                    percentComplete: Math.round(((i + 1) / totalChunks) * 100)
                });
            }
            const base64Chunk = await convertChunkToBase64(file, start, end);
            lastResponse = await sendChunk(
                serverUrl,
                base64Chunk,
                filename,
                i,
                totalChunks,
                fileId
            );
            if (lastResponse.completed) {
                break;
            }
        }
        return {
            success: true,
            message: 'File processed and uploaded in chunks successfully',
            fileId,
            filename,
            totalChunks,
            response: lastResponse
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function splitFile(file, progressCallback = null) {
    try {
        if (progressCallback) progressCallback(30);
        const fileSizeBytes = file.size;
        const chunkSizes = [
            { size: 1024 * 1024, label: '1 MB', chunks: Math.ceil(fileSizeBytes / (1024 * 1024)) },
            { size: 5 * 1024 * 1024, label: '5 MB', chunks: Math.ceil(fileSizeBytes / (5 * 1024 * 1024)) },
            { size: 10 * 1024 * 1024, label: '10 MB', chunks: Math.ceil(fileSizeBytes / (10 * 1024 * 1024)) }
        ];
        if (progressCallback) progressCallback(60);
        const { fileId } = await prepareFileForChunking(file);
        let result = `File Analysis for "${file.name}"
  Total Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB (${file.size.toLocaleString()} bytes)
  File Type: ${file.type || 'Unknown'}
  File ID: ${fileId}
  
  Recommended chunk configurations:
  `;
        chunkSizes.forEach(config => {
            const configSizeMB = config.size / (1024 * 1024);
            result += `\n${config.label} chunks: Would split into ${config.chunks} part${config.chunks !== 1 ? 's' : ''}`;
        });
        const avgUploadRate = 2 * 1024 * 1024;
        const estimatedTime = fileSizeBytes / avgUploadRate;
        result += `\n\nEstimated upload time: ${estimatedTime < 60 ?
            `${Math.ceil(estimatedTime)} seconds` :
            `${Math.ceil(estimatedTime / 60)} minutes`} (at 2 MB/sec)`;
        if (progressCallback) progressCallback(100);
        return result;
    } catch (error) {
        throw error;
    }
}

export {
    uploadFileInChunks,
    splitFile,
    prepareFileForChunking,
    sendChunk
};
