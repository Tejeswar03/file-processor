/**
 * File Encryption Module
 * Browser-compatible version of the Node.js Encrypted Zip Uploader
 * 
 * This module provides functionality to:
 * 1. Create a zip file from a file
 * 2. Encrypt the zip file using AES-256-CBC
 * 3. Convert to base64
 * 4. Send to a Python server
 */

// Encryption key - should match the server key
// For demo purposes, this is hardcoded (same as server)
const ENCRYPTION_KEY = 'VGhpc0lzQVNlY3JldEtleUZvckRlbW9Pbmx5ISEh==';

export async function processAndUploadEncrypted(file, serverUrl, progressCallback) {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    // Start progress
    if (progressCallback) progressCallback(10);
    console.log(`Processing for encrypted upload: ${file.name}`);
    
    // Step 1: Create a zip file from the input file
    console.log(`Creating zip file for: ${file.name}`);
    const zipBlob = await createZipFromFile(file, progressCallback);
    console.log(`Zip created successfully: ${zipBlob.size} bytes`);
    if (progressCallback) progressCallback(40);
    
    // Step 2: Read the zip blob as an ArrayBuffer
    const zipBuffer = await readBlobAsArrayBuffer(zipBlob);
    if (progressCallback) progressCallback(50);
    
    // Step 3: Encrypt the zip data
    console.log('Encrypting zip file...');
    const encryptedData = await encryptData(zipBuffer);
    console.log(`Zip file encrypted (${encryptedData.byteLength} bytes)`);
    if (progressCallback) progressCallback(70);
    
    // Step 4: Convert encrypted data to base64
    const encryptedBase64 = arrayBufferToBase64(encryptedData);
    if (progressCallback) progressCallback(80);
    
    // Step 5: Generate unique filename for the zip
    const zipFilename = `${file.name}_${Date.now()}.zip`;
    
    // Step 6: Send to server
    console.log('Sending encrypted data to server...');
    const response = await sendEncryptedData(serverUrl, encryptedBase64, zipFilename, progressCallback);
    console.log('Encrypted upload completed successfully');
    
    // Complete progress
    if (progressCallback) progressCallback(100);
    
    // Return success information
    return formatEncryptionResult({
      success: true,
      message: 'File processed, zipped, encrypted and uploaded successfully',
      originalFile: file,
      zipSize: zipBlob.size,
      encryptedSize: encryptedData.byteLength,
      zipFilename,
      response
    });
  } catch (error) {
    console.error(`Encryption error: ${error.message}`);
    throw new Error(`Failed to encrypt and upload file: ${error.message}`);
  }
}

/**
 * Creates a zip file from a file using JSZip
 * @param {File} file - File to zip
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Blob>} - Promise resolving to zip blob
 */
async function createZipFromFile(file, progressCallback) {
  try {
    // Dynamically import JSZip
    const JSZipModule = await import('jszip').catch(() => null);
    
    if (!JSZipModule) {
      throw new Error('JSZip library not available. Please install it with npm install jszip');
    }
    
    const JSZip = JSZipModule.default;
    const zip = new JSZip();
    
    // Add the file to the zip with its original filename
    zip.file(file.name, file);
    
    if (progressCallback) progressCallback(30);
    
    // Generate the zip file as a blob with high compression
    return await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9 // Highest compression level, same as Node.js implementation
      }
    }, (metadata) => {
      if (progressCallback) {
        // Map progress to 20-40% range
        const progress = 20 + Math.round(metadata.percent * 0.2);
        progressCallback(progress);
      }
    });
  } catch (error) {
    console.error('Error creating zip:', error);
    throw new Error(`Failed to create zip file: ${error.message}`);
  }
}

/**
 * Read a blob as ArrayBuffer
 * @param {Blob} blob - Blob to read
 * @returns {Promise<ArrayBuffer>} - Promise resolving to ArrayBuffer
 */
function readBlobAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Error reading blob'));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Encrypts data using AES-256-CBC encryption
 * This closely matches the Node.js implementation
 * @param {ArrayBuffer} data - Data to encrypt
 * @returns {ArrayBuffer} - Encrypted data with IV prepended
 */
async function encryptData(data) {
  try {
    // ✅ Decode base64 key and encode to Uint8Array properly
    const decodedKey = "ThisIsASecretKeyForDemoOnly!!!"; // now a plain binary string
    const keyBuffer = new TextEncoder().encode(decodedKey); // correctly encode to Uint8Array

    const hashedKey = await crypto.subtle.digest('SHA-256', keyBuffer);
    const iv = crypto.getRandomValues(new Uint8Array(16));

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      hashedKey,
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv },
      cryptoKey,
      data
    );

    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encryptedData), iv.length);

    return result.buffer;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }

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
  return btoa(binary);
}

/**
 * Sends the encrypted data to the server
 * @param {string} serverUrl - URL of the Python server endpoint
 * @param {string} encryptedBase64 - Base64 encoded encrypted data
 * @param {string} originalFilename - Original name of the file
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<object>} - Promise resolving to server response
 */
async function sendEncryptedData(serverUrl, encryptedBase64, originalFilename, progressCallback) {
  try {
    if (progressCallback) progressCallback(85);
    
    // Create payload matching the Node.js implementation
    const payload = {
      filename: originalFilename,
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
    throw new Error(`Error sending encrypted data: ${error.message}`);
  }
}

/**
 * Format encryption result for display
 * @param {object} result - Result object with details
 * @returns {string} - Formatted result
 */
function formatEncryptionResult(result) {
  return `Encryption and Upload Results
==========================

Original File: ${result.originalFile.name}
Original Size: ${formatFileSize(result.originalFile.size)}
Zip Size: ${formatFileSize(result.zipSize)}
Encrypted Size: ${formatFileSize(result.encryptedSize)}

Encryption Method: AES-CBC 256-bit
Compression: Zip with DEFLATE (level 9)

Server Response:
--------------
Status: ${result.success ? 'Success' : 'Failed'}
Message: ${result.message || 'N/A'}

${result.zipFilename ? `Filename: ${result.zipFilename}` : ''}
${result.response.extractionDir ? `Extraction Directory: ${result.response.extractionDir}` : ''}

${result.response.extractedFiles ? `Extracted Files:
${result.response.extractedFiles.map(file => `- ${file.name} (${formatFileSize(file.size)})`).join('\n')}` : ''}

The file has been processed, zipped, encrypted and uploaded successfully.
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