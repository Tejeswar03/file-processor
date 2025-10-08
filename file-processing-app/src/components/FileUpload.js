'use client';
import { useState, useEffect, useRef } from 'react';
import '../app/dashboard.css';
import Link from 'next/link';

export default function FileUpload({ setCurrentFile, updateProgress }) {
  const [fileInfo, setFileInfo] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const fileInputRef = useRef(null);
  const progressBarRef = useRef(null);
  const progressContainerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Format file size helper
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get icon based on file type
  const getFileIcon = (fileType) => {
    if (!fileType) return 'fa-file';

    if (fileType.startsWith('image/')) {
      return 'fa-file-image';
    } else if (fileType.startsWith('text/')) {
      return 'fa-file-alt';
    } else if (fileType.startsWith('application/pdf')) {
      return 'fa-file-pdf';
    } else if (fileType.startsWith('audio/')) {
      return 'fa-file-audio';
    } else if (fileType.startsWith('video/')) {
      return 'fa-file-video';
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return 'fa-file-excel';
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return 'fa-file-word';
    } else if (fileType.includes('zip') || fileType.includes('compressed')) {
      return 'fa-file-archive';
    } else if (fileType.includes('javascript') || fileType.includes('json') || fileType.includes('code')) {
      return 'fa-file-code';
    } else {
      return 'fa-file';
    }
  };

  const handleFileSelection = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileInfo({
        file,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || 'Unknown',
        icon: getFileIcon(file.type)
      });
      setCurrentFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      fileInputRef.current.files = e.dataTransfer.files;
      handleFileSelection({ target: { files: e.dataTransfer.files } });
    }
  };

  // Progress bar functions
  const showProgress = () => {
    if (progressContainerRef.current) {
      progressContainerRef.current.style.display = 'block';
      progressBarRef.current.style.width = '0%';
      
      // Update text as well
      const progressText = document.getElementById('progressText');
      if (progressText) {
        progressText.textContent = '0%';
      }
    }
  };

  const hideProgress = () => {
    setTimeout(() => {
      if (progressContainerRef.current) {
        progressContainerRef.current.style.display = 'none';
      }
    }, 500);
  };

  const updateProgressBar = (progress) => {
    if (progressBarRef.current) {
      // Handle both percentage number and object format
      let percent = 0;
      if (typeof progress === 'number') {
        percent = progress;
        progressBarRef.current.style.width = progress + '%';
      } else if (typeof progress === 'object') {
        // CLI-style progress object
        percent = progress.percentComplete || 0;
        progressBarRef.current.style.width = percent + '%';
      }
      
      // Update text as well
      const progressText = document.getElementById('progressText');
      if (progressText) {
        progressText.textContent = percent + '%';
      }
    }
  };

  // Helper function to decrypt data
  const decryptData = async (encryptedData, password) => {
    try {
      // Import CryptoJS dynamically
      const CryptoJS = await import('crypto-js');
      
      // Extract IV and encrypted content
      const uint8Array = new Uint8Array(encryptedData);
      const iv = uint8Array.slice(0, 16);
      const encrypted = uint8Array.slice(16);
      
      // Derive key using PBKDF2
      const salt = CryptoJS.enc.Utf8.parse('salt_1234567890');
      const key = CryptoJS.PBKDF2(password, salt, {
        keySize: 256/32,
        iterations: 100000,
        hasher: CryptoJS.algo.SHA256
      });
      
      // Decrypt using AES-CBC
      const ivWords = CryptoJS.lib.WordArray.create(iv);
      const encryptedWords = CryptoJS.lib.WordArray.create(encrypted);
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: encryptedWords
      });
      
      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: ivWords,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      // Convert to ArrayBuffer
      const decryptedWords = decrypted.words;
      const decryptedBytes = new Uint8Array(decrypted.sigBytes);
      
      for (let i = 0; i < decryptedBytes.length; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        decryptedBytes[i] = (decryptedWords[wordIndex] >>> (8 * (3 - byteIndex))) & 0xFF;
      }
      
      return decryptedBytes.buffer;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt file');
    }
  };

  // Helper function to get content type based on format
  const getContentType = (format) => {
    const contentTypes = {
      'txt': 'text/plain',
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return contentTypes[format] || 'application/octet-stream';
  };

  // Handle dropdown toggle
  const toggleDropdown = () => {
    if (!isDownloading) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  // Handle format selection and immediate download
  const handleFormatSelect = async (format) => {
    setSelectedFormat(format);
    setIsDropdownOpen(false);

    if (format) {
      setIsDownloading(true);
      showProgress();
      updateProgressBar(10);

      try {
        // Step 1: Get encrypted payload URL and password
        const response = await fetch(`/api/generate-download?format=${format}`);
        if (!response.ok) throw new Error('Failed to generate download');
        const data = await response.json();
        
        updateProgressBar(30);
        // console.log('Got download info:', data);
        
        // Step 2: Download encrypted file
        const encryptedResponse = await fetch(data.url);
        if (!encryptedResponse.ok) throw new Error('Failed to download encrypted file');
        const encryptedData = await encryptedResponse.arrayBuffer();
        
        updateProgressBar(60);
        console.log('Downloaded encrypted data:', encryptedData.byteLength, 'bytes');
        
        // Step 3: Client-side decryption
        const decryptedData = await decryptData(encryptedData, data.password);
        
        updateProgressBar(90);
        console.log('Decrypted successfully');
        
        // Step 4: Create and trigger download
        const blob = new Blob([decryptedData], { type: getContentType(format) });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        updateProgressBar(100);
        console.log('Download complete');
        
      } catch (error) {
        console.error('Download failed:', error);
      } finally {
        setTimeout(() => {
          setIsDownloading(false);
          setSelectedFormat('');
          hideProgress();
        }, 1000);
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Expose the progress functions to parent
  useEffect(() => {
    if (updateProgress) {
      updateProgress({
        show: showProgress,
        hide: hideProgress,
        update: updateProgressBar
      });
    }
  }, [updateProgress]);

  return (
    <div className="file-upload-section card">
      <div className="section-title">
        <div className="subpar">
          <i className="fas fa-upload"></i>
          File Upload
        </div>

        <div className="download-format-dropdown" style={{ display: 'flex', gap: '10px' }}>
          <div className="dropdown-container" ref={dropdownRef}>
            <button
              className="dropdown-btn"
              onClick={toggleDropdown}
              disabled={isDownloading}
            >
              <i className="fas fa-download" style={{color: 'white', opacity: isDownloading?0:1}}></i>
              {isDownloading ? 'Downloading...' : 'Download Sample'}
              <i className={`fas fa-chevron-${isDropdownOpen ? 'up' : 'down'}`} style={{color: 'white', opacity: isDownloading?0:1}}></i>
            </button>

            <div className={`dropdown-menu ${isDropdownOpen ? 'show' : ''}`}>
              <div
                className="dropdown-item txt"
                onClick={() => handleFormatSelect('txt')}
              >
                <i className="fas fa-file-alt"></i>
                <span className="dropdown-item-text">Download TXT</span>
              </div>
              <div
                className="dropdown-item pdf"
                onClick={() => handleFormatSelect('csv')}
              >
                <i className="fas fa-file-csv"></i>
                <span className="dropdown-item-text">Download CSV</span>
              </div>
              <div
                className="dropdown-item excel"
                onClick={() => handleFormatSelect('xlsx')}
              >
                <i className="fas fa-file-excel"></i>
                <span className="dropdown-item-text">Download Excel</span>
              </div>
            </div>
          </div>

          {/* Server Files Link Button */}
          <Link href="/server-files" passHref target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button
              className="dropdown-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <i className="fas fa-list" style={{color: 'white'}}></i>
              Server Files
            </button>
          </Link>
        </div>
      </div>

      <div className="file-upload-container">
        <div
          className={`dropzone ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="dropzone-icon">
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <h2 className="dropzone-title">Drag & Drop Your File</h2>
          <p className="dropzone-subtitle">
            Supports all file types. Max file size: 100MB
          </p>
          <div className="dropzone-button">Choose File</div>
          <input
            type="file"
            id="fileInput"
            ref={fileInputRef}
            onChange={handleFileSelection}
          />
        </div>

        {fileInfo && (
          <div className="file-info visible" id="fileInfo">
            <div className="file-info-header">
              <div className="file-icon">
                <i className={`fas ${fileInfo.icon}`}></i>
              </div>
              <div className="file-details">
                <div className="file-name" id="fileName">{fileInfo.name}</div>
                <div className="file-meta">
                  <div id="fileSize">
                    <i className="fas fa-weight-hanging"></i>
                    <span>{fileInfo.size}</span>
                  </div>
                  <div id="fileType">
                    <i className="fas fa-code"></i>
                    <span>{fileInfo.type}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="progress-container" ref={progressContainerRef} id="progressContainer">
          <div className="progress-bar" ref={progressBarRef} id="progressBar"></div>
          <div id="progressText" style={{ textAlign: 'center', marginTop: '8px' }}>0%</div>
        </div>
      </div>
    </div>
  );
}