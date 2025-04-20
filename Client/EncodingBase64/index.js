/**
 * File Upload and Base64 Implementation
 * 
 * This module provides functionality to:
 * 1. Read a file from a local path
 * 2. Convert the file to base64
 * 3. Send the base64 encoded file to a Python server
 */

// Using Node.js built-in modules for file system operations
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For making HTTP requests

/**
 * Reads a file from the provided path and converts it to base64
 * @param {string} filePath - Path to the file to be encoded
 * @returns {Promise<string>} - Promise resolving to base64 encoded file
 */
function readAndEncodeFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(`Error reading file: ${err.message}`);
        return;
      }
      
      // Convert buffer to base64 string
      const base64Data = data.toString('base64');
      resolve(base64Data);
    });
  });
}

/**
 * Sends the base64 encoded file to the specified server endpoint
 * @param {string} serverUrl - URL of the Python server endpoint
 * @param {string} base64Data - Base64 encoded file data
 * @param {string} originalFilename - Original name of the file
 * @returns {Promise<object>} - Promise resolving to server response
 */
async function sendToServer(serverUrl, base64Data, originalFilename) {
  try {
    const payload = {
      filename: originalFilename,
      fileData: base64Data,
      // You can add additional metadata here if needed
      timestamp: new Date().toISOString()
    };
    
    const response = await axios.post(serverUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Error sending to server: ${error.message}`);
  }
}

/**
 * Main function to process a file and send it to the server
 * @param {string} filePath - Path to the file
 * @param {string} serverUrl - URL of the Python server endpoint
 */
async function processAndUploadFile(filePath, serverUrl) {
  try {
    console.log(`Processing file: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Get original filename
    const originalFilename = path.basename(filePath);
    
    // Read and encode the file
    const base64Data = await readAndEncodeFile(filePath);
    console.log(`File encoded successfully, size: ${base64Data.length} characters`);
    
    // Send to server
    const response = await sendToServer(serverUrl, base64Data, originalFilename);
    console.log('Server response:', response);
    
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

// Example usage
// processAndUploadFile('./path/to/file.pdf', 'http://your-python-server.com/upload');

module.exports = {
  readAndEncodeFile,
  sendToServer,
  processAndUploadFile
};