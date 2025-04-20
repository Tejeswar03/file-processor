/**
 * Base64 Encoding Module
 * Converts files to Base64 format and uploads to server
 */

export async function processAndUploadFile(file, serverUrl, progressCallback) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Start progress
  if (progressCallback) progressCallback(10);

  try {
    // Encode the file to Base64
    const base64Data = await encodeFile(file, progressCallback);
    
    // Update progress before server upload
    if (progressCallback) progressCallback(80);
    
    // Actually upload to the server
    const response = await uploadBase64(base64Data, file.name, serverUrl, progressCallback);
    
    // Get a preview of the encoded data (first 1000 chars)
    const preview = base64Data.substring(0, 1000) + (base64Data.length > 1000 ? '...' : '');
    
    // Format the result with server response
    const result = `Base64 Encoding Result:
=====================

Original File: ${file.name}
Content Type: ${file.type || 'application/octet-stream'}
Original Size: ${formatFileSize(file.size)}
Encoded Size: ${formatFileSize(base64Data.length)}
Encoding Ratio: ${(base64Data.length / file.size).toFixed(2)}x

Server Upload Status:
------------------
Success: ${response.success ? 'Yes' : 'No'}
Message: ${response.message || 'N/A'}
${response.filename ? `Saved As: ${response.filename}` : ''}
${response.path ? `Server Path: ${response.path}` : ''}
${response.size ? `Size on Server: ${formatFileSize(response.size)}` : ''}

Base64 Preview (${Math.min(1000, base64Data.length)} of ${base64Data.length} characters):
${preview}

This file has been successfully uploaded to the server.
`;

    // Complete progress
    if (progressCallback) progressCallback(100);
    
    return result;
  } catch (error) {
    console.error('Base64 encoding error:', error);
    throw new Error(`Failed to encode or upload file: ${error.message}`);
  }
}

// Function to encode file to Base64
function encodeFile(file, progressCallback) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      // Get the result and remove the data URL prefix if present
      let base64String = reader.result;
      
      if (typeof base64String === 'string' && base64String.indexOf(',') !== -1) {
        base64String = base64String.split(',')[1];
      }
      
      if (progressCallback) progressCallback(70);
      resolve(base64String);
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.onprogress = (event) => {
      if (event.lengthComputable && progressCallback) {
        // Map progress to 10-60% range (leaving space for upload)
        const progressPercent = 10 + Math.round((event.loaded / event.total) * 50);
        progressCallback(progressPercent);
      }
    };
    
    // Read the file as a data URL which gives us Base64
    reader.readAsDataURL(file);
  });
}

// Function to upload base64 data to server
function uploadBase64(base64Data, fileName, serverUrl, progressCallback) {
  return new Promise((resolve, reject) => {
    // Show progress update
    if (progressCallback) progressCallback(85);
    
    // Create payload object similar to the Node.js example
    const payload = {
      filename: fileName,
      fileData: base64Data,
      timestamp: new Date().toISOString()
    };
    
    // Make the actual fetch request to the server
    fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (progressCallback) progressCallback(95);
      resolve(data);
    })
    .catch(error => {
      reject(new Error(`Upload failed: ${error.message}`));
    });
  });
}

// Helper to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}