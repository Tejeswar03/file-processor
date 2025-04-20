export async function processAndUploadFile(file, serverUrl, progressCallback) {
  if (!file) {
    throw new Error('No file provided');
  }

  if (progressCallback) progressCallback(10);

  try {
    const base64Data = await encodeFile(file, progressCallback);
    if (progressCallback) progressCallback(80);
    const response = await uploadBase64(base64Data, file.name, serverUrl, progressCallback);
    const preview = base64Data.substring(0, 1000) + (base64Data.length > 1000 ? '...' : '');
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

    if (progressCallback) progressCallback(100);
    return result;
  } catch (error) {
    console.error('Base64 encoding error:', error);
    throw new Error(`Failed to encode or upload file: ${error.message}`);
  }
}

function encodeFile(file, progressCallback) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
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
        const progressPercent = 10 + Math.round((event.loaded / event.total) * 50);
        progressCallback(progressPercent);
      }
    };
    reader.readAsDataURL(file);
  });
}

function uploadBase64(base64Data, fileName, serverUrl, progressCallback) {
  return new Promise((resolve, reject) => {
    if (progressCallback) progressCallback(85);
    const payload = {
      filename: fileName,
      fileData: base64Data,
      timestamp: new Date().toISOString()
    };
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

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}
