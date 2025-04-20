function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  async function processAndUploadFile(file, serverUrl, progressCallback) {
    if (!file) {
      throw new Error('No file provided');
    }
  
    // Start progress
    if (progressCallback) progressCallback(10);
  
    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp', new Date().toISOString());
  
      // Update progress - file preparation complete
      if (progressCallback) progressCallback(30);
  
      // Upload the file
      const response = await fetch(serverUrl, {
        method: 'POST',
        body: formData
      });
  
      // Update progress - upload complete
      if (progressCallback) progressCallback(80);
  
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
  
      const data = await response.json();
  
      // Create result message
      const result = `File Upload Result:
  =====================
  
  Original File: ${file.name}
  Content Type: ${file.type || 'application/octet-stream'}
  File Size: ${formatFileSize(file.size)}
  
  Server Upload Status:
  ------------------
  Success: ${data.success ? 'Yes' : 'No'}
  Message: ${data.message || 'N/A'}
  ${data.filename ? `Saved As: ${data.filename}` : ''}
  ${data.path ? `Server Path: ${data.path}` : ''}
  ${data.size ? `Size on Server: ${formatFileSize(data.size)}` : ''}
  
  This file has been successfully uploaded to the server.
  `;
  
      // Complete progress
      if (progressCallback) progressCallback(100);
      return result;
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }
  
  export { processAndUploadFile, formatFileSize };