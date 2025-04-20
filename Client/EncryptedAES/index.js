/**
 * Encrypted Zip Uploader
 * 
 * This module provides functionality to:
 * 1. Create a zip file from a file or directory
 * 2. Encrypt the zip file
 * 3. Convert to base64
 * 4. Send to a Python server
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const archiver = require('archiver');
const crypto = require('crypto');
const os = require('os');

// Encryption key - should match the server key
// For demo purposes, this is hardcoded
const ENCRYPTION_KEY = 'VGhpc0lzQVNlY3JldEtleUZvckRlbW9Pbmx5ISEh==';

/**
 * Creates a zip file from a file or directory
 * @param {string} sourcePath - Path to the file or directory to zip
 * @param {string} outputPath - Path where the zip file will be saved
 * @returns {Promise<string>} - Promise resolving to the path of the created zip
 */
function createZipFile(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    // Create write stream for the output file
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Highest compression level
    });

    // Listen for all archive data to be written
    output.on('close', () => {
      console.log(`Zip created successfully: ${outputPath}`);
      console.log(`Total bytes: ${archive.pointer()}`);
      resolve(outputPath);
    });

    // Catch warnings and errors
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Warning during zip creation:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Pipe archive data to the output file
    archive.pipe(output);

    // Add files or directories to the archive
    const stats = fs.statSync(sourcePath);
    if (stats.isDirectory()) {
      // Add a directory
      archive.directory(sourcePath, false);
    } else {
      // Add a file with filename as the root
      archive.file(sourcePath, { name: path.basename(sourcePath) });
    }

    // Finalize the archive
    archive.finalize();
  });
}

/**
 * Encrypts data using AES-256-CBC encryption
 * @param {Buffer} data - Data buffer to encrypt
 * @returns {Buffer} - Encrypted data buffer
 */
function encryptData(data) {
  try {
    // Decode the base64 key and ensure it's exactly 32 bytes for AES-256
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'base64');
    
    // Create a 32-byte key (using SHA-256 hash of the provided key)
    const hash = crypto.createHash('sha256');
    hash.update(keyBuffer);
    const key = hash.digest();
    
    // Generate IV (16 bytes for AES)
    const iv = crypto.randomBytes(16);
    
    // Create cipher with the key
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt the data
    const encryptedData = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    // Prepend IV to the encrypted data (so it can be retrieved for decryption)
    return Buffer.concat([iv, encryptedData]);
  } catch (error) {
    console.error(`Encryption error: ${error.message}`);
    throw error;
  }
}

/**
 * Reads and encrypts a file
 * @param {string} filePath - Path to the file to encrypt
 * @returns {Promise<Buffer>} - Promise resolving to encrypted data buffer
 */
function encryptFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(`Error reading file for encryption: ${err.message}`);
        return;
      }
      
      try {
        const encryptedData = encryptData(data);
        resolve(encryptedData);
      } catch (error) {
        reject(`Error encrypting file: ${error.message}`);
      }
    });
  });
}

/**
 * Sends the encrypted data to the server
 * @param {string} serverUrl - URL of the Python server endpoint
 * @param {Buffer} encryptedData - Encrypted data buffer
 * @param {string} originalFilename - Original name of the file
 * @returns {Promise<object>} - Promise resolving to server response
 */
async function sendEncryptedData(serverUrl, encryptedData, originalFilename) {
  try {
    const payload = {
      filename: originalFilename,
      encryptedData: encryptedData.toString('base64'),
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(serverUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      maxBodyLength: Infinity, // For large files
      maxContentLength: Infinity
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Error sending encrypted data: ${error.message}`);
  }
}

/**
 * Main function to process file, encrypt and upload
 * @param {string} sourcePath - Path to the file to process
 * @param {string} serverUrl - URL of the Python server endpoint
 * @returns {Promise<object>} - Promise resolving to result object
 */
async function processAndUploadEncrypted(sourcePath, serverUrl) {
  try {
    console.log(`Processing for encrypted upload: ${sourcePath}`);
    
    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source not found: ${sourcePath}`);
    }
    
    // Create a temporary directory for processing
    const tempDir = path.join(os.tmpdir(), 'encrypted_upload_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Generate zip filename
    const zipFilename = `${path.basename(sourcePath)}_${Date.now()}.zip`;
    const zipPath = path.join(tempDir, zipFilename);
    
    // Create zip file
    console.log(`Creating zip file: ${zipPath}`);
    await createZipFile(sourcePath, zipPath);
    
    // Encrypt the zip file
    console.log('Encrypting zip file...');
    const encryptedData = await encryptFile(zipPath);
    console.log(`Zip file encrypted (${encryptedData.length} bytes)`);
    
    // Send to server
    console.log('Sending encrypted data to server...');
    const response = await sendEncryptedData(serverUrl, encryptedData, zipFilename);
    
    // Clean up temporary files
    try {
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir, { recursive: true });
      }
    } catch (cleanupError) {
      console.warn(`Warning: Error during cleanup: ${cleanupError.message}`);
    }
    
    console.log('Encrypted upload completed successfully');
    
    return {
      success: true,
      message: 'File processed, zipped, encrypted and uploaded successfully',
      zipFilename,
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

module.exports = {
  createZipFile,
  encryptFile,
  sendEncryptedData,
  processAndUploadEncrypted
};
