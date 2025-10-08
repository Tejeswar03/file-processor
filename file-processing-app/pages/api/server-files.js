'use client'; // Remove this line if using Pages Router

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ServerFiles() {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Format file size helper
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon based on file extension
  const getFileIcon = (path) => {
    const extension = path.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
      return 'fa-file-image';
    } else if (['txt', 'log', 'md'].includes(extension)) {
      return 'fa-file-alt';
    } else if (extension === 'pdf') {
      return 'fa-file-pdf';
    } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
      return 'fa-file-audio';
    } else if (['mp4', 'webm', 'avi', 'mov'].includes(extension)) {
      return 'fa-file-video';
    } else if (['xlsx', 'xls', 'csv'].includes(extension)) {
      return 'fa-file-excel';
    } else if (['docx', 'doc', 'rtf'].includes(extension)) {
      return 'fa-file-word';
    } else if (['zip', 'rar', '7z', 'gz', 'tar'].includes(extension)) {
      return 'fa-file-archive';
    } else if (['js', 'ts', 'html', 'css', 'json', 'xml', 'py', 'java', 'php'].includes(extension)) {
      return 'fa-file-code';
    } else {
      return 'fa-file';
    }
  };

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      
      try {
        // Replace with your EC2 IP address and port
        const response = await fetch('http://35.175.195.120:9000/', {
          method: 'GET',
          mode: 'cors',
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.files) {
          setFiles(data.files);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching files:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, []);

  return (
    <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Server Files</h1>
        <Link href="/" style={{ padding: '10px 20px', backgroundColor: '#5865F2', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
          Back to Home
        </Link>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '20px', color: '#666' }}>Loading files...</div>
        </div>
      )}

      {error && (
        <div style={{ backgroundColor: '#FFEBEE', color: '#C62828', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Error loading files</h3>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!isLoading && !error && files.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>No files found on server</div>
        </div>
      )}

      {!isLoading && !error && files.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '15px', borderBottom: '1px solid #eee', backgroundColor: '#f9f9f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 120px', fontWeight: 'bold' }}>
              <div>Type</div>
              <div>File Name</div>
              <div style={{ textAlign: 'right' }}>Size</div>
            </div>
          </div>
          
          <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {files.map((file, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '12px 15px',
                  borderBottom: '1px solid #eee',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 120px',
                  alignItems: 'center'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <i className={`fas ${getFileIcon(file.path)}`} style={{ fontSize: '18px', color: '#5865F2' }}></i>
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.path}
                </div>
                <div style={{ textAlign: 'right', color: '#666' }}>
                  {formatFileSize(file.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}