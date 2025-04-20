/**
 * File Monitor Module
 * Analyzes file content and metadata
 */

export async function monitorFile(file, progressCallback) {
    if (!file) {
      throw new Error('No file provided');
    }
  
    // Start progress
    if (progressCallback) progressCallback(10);
  
    // Create a file analysis object
    const analysis = {
      name: file.name,
      type: file.type || 'Unknown',
      size: file.size,
      lastModified: new Date(file.lastModified).toLocaleString(),
      metadata: {}
    };
  
    // Update progress
    if (progressCallback) progressCallback(30);
  
    // Read file content for further analysis (first 8KB)
    const reader = new FileReader();
    
    try {
      // Read file as ArrayBuffer for content-type detection
      const headerBytes = await readFileSlice(file, 0, 8192);
      
      // Update progress
      if (progressCallback) progressCallback(50);
      
      // Analyze file type and header info
      analysis.metadata = await analyzeFileType(file, headerBytes);
      
      // Update progress
      if (progressCallback) progressCallback(70);
      
      // For text files, provide a content preview
      if (file.type.startsWith('text/') || 
          file.name.endsWith('.txt') || 
          file.name.endsWith('.csv') || 
          file.name.endsWith('.json')) {
        
        const textPreview = await readFileAsText(file, 0, 4096);
        analysis.preview = textPreview;
        
        // Calculate line count estimate for text files
        const averageLineLength = textPreview.split('\n').reduce((acc, line) => acc + line.length, 0) / 
                                (textPreview.split('\n').length || 1);
        analysis.estimatedLines = Math.round(file.size / (averageLineLength || 100));
      }
      
      // Update progress
      if (progressCallback) progressCallback(100);
      
      // Format the response
      return formatAnalysisResult(analysis);
      
    } catch (error) {
      console.error('Error analyzing file:', error);
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }
  
  // Helper function to read a slice of a file
  function readFileSlice(file, start, end) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      const slice = file.slice(start, end);
      reader.readAsArrayBuffer(slice);
    });
  }
  
  // Helper function to read a slice of a file as text
  function readFileAsText(file, start, end) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      const slice = file.slice(start, end);
      reader.readAsText(slice);
    });
  }
  
  // Helper function to analyze file type and extract metadata
  async function analyzeFileType(file, headerBytes) {
    const metadata = {};
    
    // Create a DataView for examining header bytes
    const dataView = new DataView(headerBytes);
    const uint8Array = new Uint8Array(headerBytes);
    
    // Check for common file signatures
    if (headerBytes.byteLength >= 2) {
      // Check for common file types by magic numbers
      
      // JPEG
      if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
        metadata.detectedFormat = 'JPEG image';
      }
      // PNG
      else if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && 
              uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
        metadata.detectedFormat = 'PNG image';
      }
      // GIF
      else if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && 
              uint8Array[2] === 0x46) {
        metadata.detectedFormat = 'GIF image';
      }
      // PDF
      else if (uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && 
              uint8Array[2] === 0x44 && uint8Array[3] === 0x46) {
        metadata.detectedFormat = 'PDF document';
      }
      // ZIP (includes DOCX, XLSX, etc.)
      else if (uint8Array[0] === 0x50 && uint8Array[1] === 0x4B) {
        metadata.detectedFormat = 'ZIP archive or Office document';
      }
      // Plain text detection (harder, look for all ASCII)
      else {
        let isText = true;
        
        // Check if file might be text (ASCII or UTF8)
        for (let i = 0; i < Math.min(headerBytes.byteLength, 1000); i++) {
          // Non-printable ASCII characters that aren't common control chars
          if (uint8Array[i] < 8 || (uint8Array[i] > 14 && uint8Array[i] < 32 && uint8Array[i] !== 27)) {
            isText = false;
            break;
          }
        }
        
        if (isText) {
          metadata.detectedFormat = 'Text file';
          
          // Detect JSON
          try {
            const textSlice = await readFileAsText(file, 0, 100);
            if (textSlice.trim().startsWith('{') || textSlice.trim().startsWith('[')) {
              // Try to parse as JSON
              const previewText = await readFileAsText(file, 0, 1024);
              try {
                JSON.parse(previewText);
                metadata.detectedFormat = 'JSON file';
              } catch (e) {
                // Not valid JSON, or incomplete
              }
            }
            
            // Detect CSV
            if (textSlice.includes(',') && !textSlice.includes('{')) {
              const lines = textSlice.split('\n').slice(0, 3);
              if (
                lines.length > 1 &&
                lines[0].split(',').length > 1 &&
                lines[1].split(',').length === lines[0].split(',').length
              ) {
                metadata.detectedFormat = 'CSV file';
              }
            }
          } catch (e) {
            // Error reading text, just keep as text
          }
        } else {
          metadata.detectedFormat = 'Binary file';
        }
      }
    }
    
    // Add additional metadata based on file type
    if (file.type) {
      if (file.type.startsWith('image/')) {
        // For images, let's get dimensions (we would need to load the image)
        metadata.category = 'Image';
      } else if (file.type.startsWith('video/')) {
        metadata.category = 'Video';
      } else if (file.type.startsWith('audio/')) {
        metadata.category = 'Audio';
      } else if (file.type.startsWith('text/')) {
        metadata.category = 'Text';
      } else if (file.type.includes('pdf')) {
        metadata.category = 'Document';
      } else if (file.type.includes('zip') || file.type.includes('compressed')) {
        metadata.category = 'Archive';
      } else {
        metadata.category = 'Other';
      }
    }
    
    // Calculate SHA-256 hash would go here (would require additional crypto libraries)
    
    return metadata;
  }
  
  // Format the analysis result as readable text
  function formatAnalysisResult(analysis) {
    let formattedOutput = `File Analysis Report
  ====================
  
  Basic Information:
  -----------------
  Filename: ${analysis.name}
  Type: ${analysis.type}
  Size: ${formatFileSize(analysis.size)}
  Last Modified: ${analysis.lastModified}
  
  Detected Format: ${analysis.metadata.detectedFormat || 'Unknown'}
  Category: ${analysis.metadata.category || 'Unknown'}
  `;
  
    // Add estimated line count for text files
    if (analysis.estimatedLines) {
      formattedOutput += `Estimated Lines: ${analysis.estimatedLines.toLocaleString()}\n`;
    }
  
    // Add preview for text files
    if (analysis.preview) {
      formattedOutput += `\nContent Preview:
  ---------------
  ${analysis.preview.substring(0, 500)}${analysis.preview.length > 500 ? '...' : ''}
  `;
    }
  
    return formattedOutput;
  }
  
  // Helper to format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  }