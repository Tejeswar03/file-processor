/**
 * File Encryption Module
 * Encrypts files with AES-CBC encryption and sends to server
 */

// Encryption key - should match the server key
// For demo purposes, this is hardcoded
const ENCRYPTION_KEY = 'VGhpc0lzQVNlY3JldEtleUZvckRlbW9Pbmx5ISEh==';

export async function processAndUploadEncrypted(file, serverUrl, progressCallback) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Start progress
  if (progressCallback) progressCallback(10);

  try {
    // Create a zip file from the input file
    const { zipBlob, zipFileName } = await createZipFromFile(file, progressCallback);
    if (progressCallback) progressCallback(40);
    
    // Read the zip file as ArrayBuffer
    const zipArrayBuffer = await readBlobAsArrayBuffer(zipBlob, progressCallback);
    if (progressCallback) progressCallback(60);
    
    // Encrypt the zip file
    const encryptedData = await encryptData(zipArrayBuffer);
    if (progressCallback) progressCallback(80);
    
    // Convert encrypted data to base64 and send to server
    const encryptedBase64 = arrayBufferToBase64(encryptedData);
    const response = await sendEncryptedData(serverUrl, encryptedBase64, zipFileName, progressCallback);
    
    // Complete progress
    if (progressCallback) progressCallback(100);
    
    // Return encryption and upload info
    return formatEncryptionResult(file, zipBlob, encryptedData, response);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt and upload file: ${error.message}`);
  }
}

/**
 * Creates a zip file from a file using client-side JSZip
 * @param {File} file - File to zip
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<{zipBlob: Blob, zipFileName: string}>} - Promise resolving to zip blob and filename
 */
async function createZipFromFile(file, progressCallback) {
  try {
    // Dynamically import JSZip (will need to be installed)
    const JSZip = (await import('jszip')).default;
    
    // Create a new zip file
    const zip = new JSZip();
    
    // Add the file to the zip
    zip.file(file.name, file);
    
    if (progressCallback) progressCallback(30);
    
    // Generate the zip file as a blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9 // highest compression level
      }
    }, (metadata) => {
      if (progressCallback) {
        // Map progress to 20-40% range
        const progress = 20 + Math.round(metadata.percent * 0.2);
        progressCallback(progress);
      }
    });
    
    // Generate a zip filename
    const zipFileName = `${file.name}_${Date.now()}.zip`;
    
    return { zipBlob, zipFileName };
  } catch (error) {
    console.error('Error creating zip:', error);
    throw new Error(`Failed to create zip file: ${error.message}`);
  }
}

/**
 * Encrypts data using AES-256-CBC encryption
 * @param {ArrayBuffer} data - Data to encrypt
 * @returns {ArrayBuffer} - Encrypted data
 */
async function encryptData(data) {
  try {
    // Decode the base64 key
    const keyBuffer = _base64ToArrayBuffer(ENCRYPTION_KEY);
    
    // Hash the key to get a 32-byte key for AES-256
    const hashedKey = await crypto.subtle.digest('SHA-256', keyBuffer);
    
    // Generate a random IV (16 bytes for AES-CBC)
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    // Import the key for use with the Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      hashedKey,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv: iv
      },
      cryptoKey,
      data
    );
    
    // Combine IV and encrypted data (similar to the Node.js version)
    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedData), iv.length);
    
    return result.buffer;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
}

/**
 * Helper function to convert base64 to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} - Converted ArrayBuffer
 */
function _base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Read a blob as ArrayBuffer
 * @param {Blob} blob - Blob to read
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<ArrayBuffer>} - Promise resolving to ArrayBuffer
 */
function readBlobAsArrayBuffer(blob, progressCallback) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      resolve(reader.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading blob'));
    };
    
    reader.onprogress = (event) => {
      if (event.lengthComputable && progressCallback) {
        // Map progress to 40-60% range
        const progress = 40 + Math.round((event.loaded / event.total) * 20);
        progressCallback(progress);
      }
    };
    
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Convert ArrayBuffer to Base64 string
 * @param {ArrayBuffer} buffer - ArrayBuffer to convert
 * @returns {string} - Base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Send encrypted data to server
 * @param {string} serverUrl - Server URL
 * @param {string} encryptedBase64 - Base64 encoded encrypted data
 * @param {string} fileName - File name
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<object>} - Promise resolving to server response
 */
async function sendEncryptedData(serverUrl, encryptedBase64, fileName, progressCallback) {
  try {
    if (progressCallback) progressCallback(85);
    
    // Create payload similar to the Node.js version
    const payload = {
      filename: fileName,
      encryptedData: encryptedBase64,
      timestamp: new Date().toISOString()
    };
    
    // Send to server
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }
    
    if (progressCallback) progressCallback(95);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to send encrypted data: ${error.message}`);
  }
}

/**
 * Format encryption result for display
 * @param {File} originalFile - Original file
 * @param {Blob} zipBlob - Zip blob
 * @param {ArrayBuffer} encryptedData - Encrypted data
 * @param {object} serverResponse - Server response
 * @returns {string} - Formatted result
 */
function formatEncryptionResult(originalFile, zipBlob, encryptedData, serverResponse) {
  return `Encryption and Upload Results
==========================

Original File: ${originalFile.name}
Original Size: ${formatFileSize(originalFile.size)}
Zip Size: ${formatFileSize(zipBlob.size)}
Encrypted Size: ${formatFileSize(encryptedData.byteLength)}

Encryption Method: AES-CBC 256-bit

Server Response:
--------------
Status: ${serverResponse.success ? 'Success' : 'Failed'}
Message: ${serverResponse.message || 'N/A'}

${serverResponse.zipFilename ? `Zip Filename: ${serverResponse.zipFilename}` : ''}
${serverResponse.extractionDir ? `Extraction Directory: ${serverResponse.extractionDir}` : ''}

${serverResponse.extractedFiles ? `Extracted Files:
${serverResponse.extractedFiles.map(file => `- ${file.name} (${formatFileSize(file.size)})`).join('\n')}` : ''}

The file has been encrypted, zipped, and uploaded successfully.
`;
}

/**
 * Helper function to format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}