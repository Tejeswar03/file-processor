const ENCRYPTION_KEY = 'VGhpc0lzQVNlY3JldEtleUZvckRlbW9Pbmx5ISEh==';


async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsArrayBuffer(file);
  });
}

function pkcs7Pad(data) {
  const blockSize = 16; // AES block size
  const paddingSize = blockSize - (data.length % blockSize);

  const padded = new Uint8Array(data.length + paddingSize);
  padded.set(data);

  // Fill padding bytes with the padding size value
  for (let i = data.length; i < padded.length; i++) {
    padded[i] = paddingSize;
  }

  return padded;
}

async function encryptFileData(fileData) {
  try {
    console.log("Starting AES-CBC encryption...");

    // Generate random IV (16 bytes for AES-CBC)
    let iv;
    try {
      // Try using the crypto API for secure random generation
      iv = window.crypto.getRandomValues(new Uint8Array(16));
    } catch (e) {
      // Fallback for environments without crypto.getRandomValues
      iv = new Uint8Array(16);
      for (let i = 0; i < 16; i++) {
        iv[i] = Math.floor(Math.random() * 256);
      }
    }
    console.log("Generated IV:", Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''));

    let keyBytes;
    try {
      // Try to decode the base64 key
      const base64 = ENCRYPTION_KEY.replace(/[^A-Za-z0-9+/]/g, '');
      const binaryString = window.atob(base64);
      keyBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        keyBytes[i] = binaryString.charCodeAt(i);
      }
      console.log("Decoded key bytes:", keyBytes.length);
    } catch (e) {
      console.warn("Error decoding base64 key, using fallback:", e);
      keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
    }

    let keyHash;
    try {
      // Try using Web Crypto API for hashing
      keyHash = await window.crypto.subtle.digest('SHA-256', keyBytes);
    } catch (e) {
      console.warn("Crypto API digest failed, using fallback:", e);
      // Simplified SHA-256 implementation (only for demo/fallback)
      keyHash = simpleSha256(keyBytes);
    }


    let cryptoKey;
    try {
      // Try using Web Crypto API for key import
      cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyHash,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );
    } catch (e) {
      console.warn("Crypto API key import failed:", e);
      // At this point, we can't encrypt without the Web Crypto API
      // We'll use our fallback encryption implementation
      return fallbackEncrypt(fileData, new Uint8Array(keyHash), iv);
    }

    // Prepare data with padding
    const dataArray = new Uint8Array(fileData);
    const paddedData = pkcs7Pad(dataArray);

    // Encrypt with AES-CBC
    let encryptedData;
    try {
      encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        paddedData
      );
    } catch (e) {
      console.warn("Crypto API encryption failed:", e);
      // Use fallback encryption
      return fallbackEncrypt(fileData, new Uint8Array(keyHash), iv);
    }

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encryptedData.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encryptedData), iv.length);

    console.log(`Encryption complete: ${result.byteLength} bytes (IV + encrypted data)`);
    return result.buffer;
  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
}

function fallbackEncrypt(data, key, iv) {
  console.warn("Using fallback encryption (NOT SECURE - for demo only)");

  // Pad the data
  const paddedData = pkcs7Pad(new Uint8Array(data));
  const encrypted = new Uint8Array(paddedData.length);
  for (let i = 0; i < paddedData.length; i++) {
    // XOR with key and IV
    encrypted[i] = paddedData[i] ^ key[i % key.length] ^ iv[i % iv.length];
  }

  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encrypted.length);
  result.set(iv);
  result.set(encrypted, iv.length);

  return result.buffer;
}

function simpleSha256(data) {
  // This is NOT a real SHA-256 implementation!
  // It's just a simple hash function for fallback when crypto API is unavailable
  const hash = new Uint8Array(32);

  // Simple hash calculation
  let h1 = 0x1234;
  let h2 = 0x5678;

  for (let i = 0; i < data.length; i++) {
    h1 = ((h1 << 5) - h1 + data[i]) | 0;
    h2 = ((h2 << 7) - h2 + (data[i] ^ 0x55)) | 0;
  }

  // Fill hash with calculated values
  for (let i = 0; i < 16; i++) {
    hash[i] = (h1 >> (i % 8)) & 0xFF;
    hash[i + 16] = (h2 >> (i % 8)) & 0xFF;
  }

  return hash.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function processAndUploadEncrypted(file, serverUrl, progressCallback = null) {
  try {
    console.log(`Processing for encrypted upload: ${file.name}`);
    console.log(`Target server URL: ${serverUrl}`);

    // Update progress
    if (progressCallback) progressCallback(10);

    // Read the file
    const fileData = await readFileAsArrayBuffer(file);
    if (progressCallback) progressCallback(30);

    // Original filename without timestamp
    const originalFilename = file.name;

    // Encrypt the file data
    const encryptedBuffer = await encryptFileData(fileData);
    if (progressCallback) progressCallback(60);

    console.log(`File encrypted (${encryptedBuffer.byteLength} bytes)`);

    // Convert to base64
    const base64EncryptedData = arrayBufferToBase64(encryptedBuffer);

    // Prepare payload
    const payload = {
      filename: originalFilename,
      encryptedData: base64EncryptedData,
      timestamp: new Date().toISOString()
    };

    // Send to server
    console.log('Sending encrypted data to server...');
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (progressCallback) progressCallback(100);

    console.log('Encrypted upload completed', result);

    return {
      success: true,
      message: 'File encrypted and uploaded successfully',
      filename: originalFilename,
      response: result
    };
  } catch (error) {
    console.error(`Error:`, error);
    return {
      success: false,
      message: error.message || 'An unknown error occurred'
    };
  }
}


export {
  processAndUploadEncrypted,
  encryptFileData,
  readFileAsArrayBuffer
};
