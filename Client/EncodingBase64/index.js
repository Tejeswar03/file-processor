function readAndEncodeFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
        };

        reader.onerror = () => {
            reject(new Error('Error reading file for Base64 encoding'));
        };

        reader.readAsDataURL(file);
    });
}

async function sendToServer(serverUrl, base64Data, originalFilename, fileType) {
    try {
        const payload = {
            filename: originalFilename,
            fileData: base64Data,
            fileType: fileType,
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
        throw new Error(`Error sending to server: ${error.message}`);
    }
}

async function processAndUploadFile(file, serverUrl, progressCallback = null) {
    try {
        console.log(`Processing file: ${file.name}`);

        if (progressCallback) progressCallback(20);

        const base64Data = await readAndEncodeFile(file);
        console.log(`File encoded successfully, size: ${base64Data.length} characters`);

        if (progressCallback) progressCallback(70);

        const response = await sendToServer(serverUrl, base64Data, file.name, file.type);
        console.log('Server response:', response);

        if (progressCallback) progressCallback(100);

        return {
            success: true,
            message: 'File processed and uploaded successfully',
            response
        };
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            success: false,
            message: error.message
        };
    }
}

async function encodeFile(file, progressCallback = null) {
    try {
        if (progressCallback) progressCallback(20);

        const base64Data = await readAndEncodeFile(file);

        if (progressCallback) progressCallback(100);

        if (base64Data.length > 10000) {
            const previewLength = 1000;
            return `Base64 encoded content (showing first ${previewLength} characters):\n\n${base64Data.substring(0, previewLength)}...\n\n[Total encoded length: ${base64Data.length.toLocaleString()} characters]`;
        } else {
            return base64Data;
        }
    } catch (error) {
        console.error(`Error encoding file: ${error.message}`);
        throw error;
    }
}

export {
    readAndEncodeFile,
    sendToServer,
    processAndUploadFile,
    encodeFile
};
