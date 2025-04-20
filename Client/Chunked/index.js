

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Reads a file and splits it into chunks of specified size
 * @param {string} filePath - Path to the file to be chunked
 * @param {number} chunkSize - Size of each chunk in bytes (default: 1MB)
 * @returns {Promise<{buffer: Buffer, totalChunks: number, fileId: string}>} - File buffer, chunk count, and unique file ID
 */
async function readAndChunkFile(filePath, chunkSize = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, buffer) => {
      if (err) {
        reject(`Error reading file: ${err.message}`);
        return;
      }
      
      const totalSize = buffer.length;
      const totalChunks = Math.ceil(totalSize / chunkSize);
      
      // Generate a unique file ID based on filename and timestamp
      const fileId = crypto.createHash('md5')
        .update(`${path.basename(filePath)}_${Date.now()}`)
        .digest('hex');
      
      resolve({
        buffer,
        totalChunks,
        fileId
      });
    });
  });
}

/**
 * Sends a single chunk to the server
 * @param {string} serverUrl - URL of the Python server endpoint
 * @param {Buffer} chunkBuffer - Buffer containing chunk data
 * @param {string} filename - Original name of the file
 * @param {number} chunkIndex - Index of the current chunk (0-based)
 * @param {number} totalChunks - Total number of chunks
 * @param {string} fileId - Unique identifier for the file
 * @returns {Promise<object>} - Promise resolving to server response
 */
async function sendChunk(serverUrl, chunkBuffer, filename, chunkIndex, totalChunks, fileId) {
  try {
    // Convert buffer to base64
    const base64Chunk = chunkBuffer.toString('base64');
    
    const payload = {
      filename,
      fileId,
      chunkIndex,
      totalChunks,
      chunkData: base64Chunk,
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(serverUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Error sending chunk ${chunkIndex}: ${error.message}`);
  }
}

/**
 * Process file in chunks and upload to server
 * @param {string} filePath - Path to the file
 * @param {string} serverUrl - URL of the Python server endpoint
 * @param {number} chunkSize - Size of each chunk in bytes (default: 1MB)
 * @param {function} progressCallback - Optional callback for progress updates
 * @returns {Promise<object>} - Promise resolving to final server response
 */
async function uploadFileInChunks(filePath, serverUrl, chunkSize = 1024 * 1024, progressCallback = null) {
  try {
    console.log(`Processing file: ${filePath} in chunks of ${chunkSize} bytes`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Get original filename
    const filename = path.basename(filePath);
    
    // Read and chunk the file
    const { buffer, totalChunks, fileId } = await readAndChunkFile(filePath, chunkSize);
    console.log(`File will be split into ${totalChunks} chunks with ID: ${fileId}`);
    
    let lastResponse = null;
    
    // Process each chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunkBuffer = buffer.slice(start, end);
      
      // Update progress if callback provided
      if (progressCallback && typeof progressCallback === 'function') {
        progressCallback({
          filename,
          fileId,
          currentChunk: i + 1,
          totalChunks,
          percentComplete: Math.round(((i + 1) / totalChunks) * 100)
        });
      }
      
      console.log(`Sending chunk ${i + 1}/${totalChunks} (${chunkBuffer.length} bytes)`);
      
      // Send the chunk
      lastResponse = await sendChunk(
        serverUrl,
        chunkBuffer,
        filename,
        i,
        totalChunks,
        fileId
      );
      
      // If the server indicates the file is complete, we can stop
      if (lastResponse.completed) {
        console.log('Server indicates file is complete');
        break;
      }
    }
    
    console.log(`Chunked upload completed for: ${filename}`);
    
    return {
      success: true,
      message: 'File processed and uploaded in chunks successfully',
      fileId,
      filename,
      totalChunks,
      response: lastResponse
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
  readAndChunkFile,
  sendChunk,
  uploadFileInChunks
};