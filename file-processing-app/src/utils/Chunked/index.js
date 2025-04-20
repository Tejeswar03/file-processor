/**
 * File Chunking Module
 * Splits files into chunks for efficient upload
 */

export async function uploadFileInChunks(file, serverUrl, chunkSize = 1048576, progressCallback) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Default chunk size: 1MB
  chunkSize = chunkSize || 1048576;

  // Start progress
  if (progressCallback) progressCallback(10);
  
  try {
    // Calculate optimal chunk sizes
    const chunks = calculateChunks(file, chunkSize);
    
    // Update progress
    if (progressCallback) progressCallback(20);
    
    // Generate a unique file ID for tracking chunks on server
    const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Analyze the first chunk for visualization (same as before)
    const chunkData = await analyzeChunks(file, chunks, progressCallback);
    
    // Update progress before starting upload
    if (progressCallback) progressCallback(30);
    
    // Start uploading chunks
    let uploadResults = [];
    let finalResponse = null;
    
    for (let i = 0; i < chunks.totalChunks; i++) {
      const chunk = chunks.chunks[i];
      
      // Read the chunk data
      const chunkArrayBuffer = await readChunk(file, chunk.start, chunk.end);
      
      // Convert chunk to Base64 for JSON upload
      const base64Chunk = arrayBufferToBase64(chunkArrayBuffer);
      
      // Upload the chunk
      const response = await uploadChunk(
        base64Chunk, 
        file.name, 
        i, 
        chunks.totalChunks,
        fileId,
        serverUrl
      );
      
      uploadResults.push(response);
      
      // Check if upload is complete
      if (response.completed) {
        finalResponse = response;
      }
      
      // Update progress (30-90% range)
      const progressPercent = 30 + Math.round((i + 1) / chunks.totalChunks * 60);
      if (progressCallback) {
        progressCallback({
          percentComplete: progressPercent,
          currentChunk: i + 1,
          totalChunks: chunks.totalChunks
        });
      }
    }
    
    // Complete progress
    if (progressCallback) progressCallback(100);
    
    // Return both analysis info and upload results
    return formatUploadResult(file, chunks, chunkData, uploadResults, finalResponse);
  } catch (error) {
    console.error('Chunking error:', error);
    throw new Error(`Failed to process file chunks: ${error.message}`);
  }
}

// Read a chunk from the file
async function readChunk(file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Error reading file chunk'));
    
    const slice = file.slice(start, end);
    reader.readAsArrayBuffer(slice);
  });
}

// Upload a single chunk to the server
function uploadChunk(chunkData, filename, chunkIndex, totalChunks, fileId, serverUrl) {
  return new Promise((resolve, reject) => {
    fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: filename,
        chunkData: chunkData,
        chunkIndex: chunkIndex,
        totalChunks: totalChunks,
        fileId: fileId
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      resolve(data);
    })
    .catch(error => {
      reject(new Error(`Chunk upload failed: ${error.message}`));
    });
  });
}

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Calculate chunks based on file size
function calculateChunks(file, chunkSize) {
  const fileSize = file.size;
  const totalChunks = Math.ceil(fileSize / chunkSize);
  
  // Create chunk info array
  const chunks = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(fileSize, start + chunkSize);
    
    chunks.push({
      index: i,
      start,
      end,
      size: end - start
    });
  }
  
  return {
    totalSize: fileSize,
    chunkSize,
    totalChunks,
    chunks
  };
}

// Analyze a few chunks for content visualization
async function analyzeChunks(file, chunkInfo, progressCallback) {
  // For demonstration, we'll analyze just the first chunk
  // In a real application, you'd process all chunks
  
  const firstChunk = chunkInfo.chunks[0];
  const slice = file.slice(firstChunk.start, firstChunk.end);
  
  // Create a readable version of the first few bytes
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Generate a hex dump of the first 128 bytes
  const hexDump = generateHexDump(bytes.slice(0, 128));
  
  // Mock transfer rates based on file type and size
  const transferRates = estimateTransferRates(file, chunkInfo.chunkSize);
  
  return {
    firstChunkPreview: hexDump,
    transferRates
  };
}

// Generate a hex dump of bytes
function generateHexDump(bytes) {
  const BYTES_PER_LINE = 16;
  let output = '';
  
  for (let i = 0; i < bytes.length; i += BYTES_PER_LINE) {
    // Add offset
    output += `0x${i.toString(16).padStart(8, '0')}: `;
    
    // Add hex values
    for (let j = 0; j < BYTES_PER_LINE; j++) {
      if (i + j < bytes.length) {
        output += bytes[i + j].toString(16).padStart(2, '0') + ' ';
      } else {
        output += '   ';
      }
      
      // Add extra space in the middle
      if (j === 7) {
        output += ' ';
      }
    }
    
    // Add ASCII representation
    output += ' |';
    for (let j = 0; j < BYTES_PER_LINE; j++) {
      if (i + j < bytes.length) {
        const byte = bytes[i + j];
        // Only print printable ASCII characters
        output += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      } else {
        output += ' ';
      }
    }
    output += '|\n';
  }
  
  return output;
}

// Estimate transfer rates for different network types
function estimateTransferRates(file, chunkSize) {
  // These are rough estimates for demonstration
  const networkSpeeds = {
    '3G': 1.5 * 1024 * 1024 / 8, // 1.5 Mbps in bytes/sec
    '4G': 15 * 1024 * 1024 / 8,  // 15 Mbps in bytes/sec
    'WiFi': 30 * 1024 * 1024 / 8, // 30 Mbps in bytes/sec
    'Fiber': 100 * 1024 * 1024 / 8 // 100 Mbps in bytes/sec
  };
  
  const fileSize = file.size;
  const results = {};
  
  // Calculate transfer times for each network type
  for (const [networkType, speed] of Object.entries(networkSpeeds)) {
    // Calculate total transfer time
    const totalTime = fileSize / speed;
    
    // Calculate time per chunk
    const timePerChunk = chunkSize / speed;
    
    results[networkType] = {
      totalTime: formatTime(totalTime),
      timePerChunk: formatTime(timePerChunk),
      chunksPerSecond: Math.floor(speed / chunkSize),
      bytesPerSecond: formatFileSize(speed) + '/s'
    };
  }
  
  return results;
}

// Format the upload result with both analysis info and upload results
function formatUploadResult(file, chunkInfo, chunkData, uploadResults, finalResponse) {
  // First part - analysis info (same as before)
  let output = `File Chunking Upload Results
==========================

Original File: ${file.name}
File Size: ${formatFileSize(file.size)}
Content Type: ${file.type || 'application/octet-stream'}

Chunk Configuration:
------------------
Chunk Size: ${formatFileSize(chunkInfo.chunkSize)}
Total Chunks: ${chunkInfo.totalChunks}
`;

  // Add upload status section
  output += `
Upload Status:
------------
Chunks Uploaded: ${uploadResults.length}/${chunkInfo.totalChunks}
`;

  // Add server response if available
  if (finalResponse) {
    output += `
Server Response:
--------------
Status: ${finalResponse.success ? 'Success' : 'Failed'}
Message: ${finalResponse.message}
`;
    
    if (finalResponse.filename) {
      output += `Saved As: ${finalResponse.filename}\n`;
    }
    
    if (finalResponse.path) {
      output += `Server Path: ${finalResponse.path}\n`;
    }
    
    if (finalResponse.size) {
      output += `Size on Server: ${formatFileSize(finalResponse.size)}\n`;
    }
  }

  // Add chunk breakdown
  output += `
Chunk Breakdown:
--------------
`;

  const maxChunksToShow = Math.min(5, chunkInfo.chunks.length);
  for (let i = 0; i < maxChunksToShow; i++) {
    const chunk = chunkInfo.chunks[i];
    output += `Chunk ${i + 1}: ${formatFileSize(chunk.size)} (Bytes ${chunk.start}-${chunk.end})\n`;
  }
  
  if (chunkInfo.chunks.length > maxChunksToShow) {
    output += `... and ${chunkInfo.chunks.length - maxChunksToShow} more chunks\n`;
  }
  
  // Add first chunk preview
  output += `\nFirst Chunk Preview (Hex Dump):
--------------------------
${chunkData.firstChunkPreview}
`;

  // Add transfer rate estimates
  output += `
Estimated Transfer Rates:
----------------------
`;

  for (const [networkType, data] of Object.entries(chunkData.transferRates)) {
    output += `${networkType}: 
  - Total transfer time: ${data.totalTime}
  - Time per chunk: ${data.timePerChunk}
  - Transfer speed: ${data.bytesPerSecond}
\n`;
  }
  
  // Add recommendations
  output += `
Recommendations:
--------------
`;

  if (chunkInfo.chunkSize < 256 * 1024) {
    output += '- Consider increasing chunk size for better performance with fewer HTTP requests\n';
  } else if (chunkInfo.chunkSize > 10 * 1024 * 1024) {
    output += '- Consider decreasing chunk size for better error recovery and progress reporting\n';
  } else {
    output += '- Current chunk size provides a good balance between efficiency and resilience\n';
  }
  
  if (chunkInfo.totalChunks > 100) {
    output += '- File has many chunks; consider implementing pause/resume functionality\n';
  }
  
  output += '- Use a backoff strategy for failed chunk uploads\n';
  output += '- Consider adding checksums to verify chunk integrity\n';
  
  return output;
}

// Format time in seconds to a human-readable string
function formatTime(seconds) {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms`;
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes} min ${remainingSeconds} sec`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hr ${minutes} min`;
  }
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}