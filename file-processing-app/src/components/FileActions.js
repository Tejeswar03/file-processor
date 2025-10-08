'use client';
import { useState, useEffect } from 'react';

export default function FileActions({
  currentFile,
  progressControls,
  setResultData,
  setIsResultVisible
}) {
  const [chunkSize, setChunkSize] = useState(100); // Default: 1MB
  const [isPopupVisible, setIsPopupVisible] = useState(false);

  // Mock server URLs (for display purposes)
  const serverUrls = {
    upload: 'wss://ws.files.attackvault.xyz',
    regular: '  https://see.files.attackvault.xyz/upload_regular',
    encoded: '  https://see.files.attackvault.xyz/upload_encoded',
    encrypted: '  https://see.files.attackvault.xyz/upload_encrypted',
    chunked: '  https://see.files.attackvault.xyz/upload_chunked'
  };

  const handleRegular = async () => {
    if (!currentFile || !window.uploadFile) return;
    const serverUrl = serverUrls.regular;
    progressControls.show();
    setIsResultVisible(false);
    try {
      const result = await window.uploadFile.processAndUploadFile(
        currentFile,
        serverUrl,
        progressControls.update
      );
      setResultData({
        title: 'Regular Upload',
        content: result,
        icon: 'cloud-upload-alt'
      });
      setIsResultVisible(true);
    } catch (error) {
      setResultData({
        title: 'Error',
        content: error.message || String(error),
        icon: 'exclamation-circle'
      });
      setIsResultVisible(true);
    } finally {
      progressControls.hide();
    }
  };

  const handleWebSocket = async () => {
    if (!currentFile || !window.socketUploadFile) {
      console.error('No file selected or WebSocket module not loaded');
      return;
    }

    const serverUrl = serverUrls.upload;
    progressControls.show();
    setIsResultVisible(false);

    try {
      // Now this correctly matches the exported function name
      const result = await window.socketUploadFile.processAndUploadFile(
        currentFile,
        serverUrl,
        progressControls.update
      );

      setResultData({
        title: 'WebSocket Upload',
        content:  JSON.stringify(result, null, 2),
        icon: 'cloud-upload-alt'
      });
      setIsResultVisible(true);
    } catch (error) {
      console.error('WebSocket upload error:', error);
      setResultData({
        title: 'Error',
        content: error.message || String(error),
        icon: 'exclamation-circle'
      });
      setIsResultVisible(true);
    } finally {
      progressControls.hide();
    }
  };

  const handleBase64 = async () => {
    if (!currentFile || !window.base64Handler) return;

    const serverUrl = serverUrls.encoded;
    progressControls.show();
    setIsResultVisible(false);

    try {
      const result = await window.base64Handler.processAndUploadFile(
        currentFile,
        serverUrl,
        progressControls.update
      );
      setResultData({
        title: 'Base64 Encoded Content',
        content: result,
        icon: 'exchange-alt'
      });
      setIsResultVisible(true);
    } catch (error) {
      setResultData({
        title: 'Error',
        content: error.message || String(error),
        icon: 'exclamation-circle'
      });
      setIsResultVisible(true);
    } finally {
      progressControls.hide();
    }
  };

  const handleEncrypt = async () => {
    if (!currentFile || !window.encryptionHandler) return;

    const serverUrl = serverUrls.encrypted;
    progressControls.show();
    setIsResultVisible(false);

    try {
      const result = await window.encryptionHandler.processAndUploadEncrypted(
        currentFile,
        serverUrl,
        progressControls.update
      );
      setResultData({
        title: 'Encrypted Result',
        content: result,
        icon: 'lock'
      });
      setIsResultVisible(true);
    } catch (error) {
      setResultData({
        title: 'Error',
        content: error.message || String(error),
        icon: 'exclamation-circle'
      });
      setIsResultVisible(true);
    } finally {
      progressControls.hide();
    }
  };

  const handleChunks = async () => {
    if (!currentFile || !window.chunkHandler) return;

    const serverUrl = serverUrls.chunked;
    progressControls.show();
    setIsResultVisible(false);
    setIsPopupVisible(false); // Close popup after submitting

    try {
      const result = await window.chunkHandler.uploadFileInChunks(
        currentFile,
        serverUrl,
        chunkSize,
        progressControls.update
      );
      setResultData({
        title: 'File Chunks Information',
        content: result,
        icon: 'puzzle-piece'
      });
      setIsResultVisible(true);
    } catch (error) {
      setResultData({
        title: 'Error',
        content: error.message || String(error),
        icon: 'exclamation-circle'
      });
      setIsResultVisible(true);
    } finally {
      progressControls.hide();
    }
  };

  // Handle clicking outside of popup to close it
  const handleClickOutside = (event) => {
    const popup = document.getElementById('chunkSizePopup');
    
    if (popup && !popup.contains(event.target) && 
        !event.target.closest('.chunks')) {
      setIsPopupVisible(false);
    }
  };

  // Add and remove event listener for click outside
  useEffect(() => {
    if (isPopupVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupVisible]);

  return (
    <>
      <div className="actions-section card">
        <div className="section-title">
          <i className="fas fa-bolt"></i>
          File Operations
        </div>
        <div className="actions-container">
          <div
            className={`action-card monitor ${!currentFile ? 'disabled' : ''}`}
            onClick={currentFile ? handleRegular : null}
          >
            <div className="action-icon">
              <i className="fas fa-chart-bar"></i>
            </div>
            <div className="action-title">Normal Upload</div>
            <div className="action-desc">Transfer file via Normal method</div>
          </div>

          <div
            className={`action-card base64 ${!currentFile ? 'disabled' : ''}`}
            onClick={currentFile ? handleBase64 : null}
          >
            <div className="action-icon">
              <i className="fas fa-exchange-alt"></i>
            </div>
            <div className="action-title">Base64 Encoding</div>
            <div className="action-desc">Convert file to Base64 format</div>
          </div>

          <div
            className={`action-card encrypt ${!currentFile ? 'disabled' : ''}`}
            onClick={currentFile ? handleEncrypt : null}
          >
            <div className="action-icon">
              <i className="fas fa-lock"></i>
            </div>
            <div className="action-title">Encryption</div>
            <div className="action-desc">Encrypt file with AES-CBC</div>
          </div>

          <div
            className={`action-card chunks ${!currentFile ? 'disabled' : ''}`}
            onClick={() => {
              if (currentFile) {
                setIsPopupVisible(!isPopupVisible);
              }
            }}
          >
            <div className="action-icon">
              <i className="fas fa-puzzle-piece"></i>
            </div>
            <div className="action-title">File Chunks</div>
            <div className="action-desc">Analyze optimal chunk sizes</div>
          </div>

          <div
            className={`action-card websocket ${!currentFile ? 'disabled' : ''}`}
            onClick={currentFile ? handleWebSocket : null}
          >
            <div className="action-icon">
              <i className="fas fa-plug"></i>
            </div>
            <div className="action-title">WebSocket Upload</div>
            <div className="action-desc">Transfer file via WebSocket</div>
          </div>
        </div>
      </div>

      {/* Popup Dialog for Chunk Size */}
      {isPopupVisible && (
        <div 
          className="popup-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div 
            id="chunkSizePopup" 
            className="popup-content"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              width: '400px',
              maxWidth: '90%',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div 
              className="popup-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                File Chunk Settings
              </h3>
              <button 
                onClick={() => setIsPopupVisible(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="form-group">
              <label htmlFor="chunkSizeInput" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Chunk Size (bytes):
              </label>
              <input
                type="number"
                id="chunkSizeInput"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ECEFF1' }}
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value) || 100)}
              />
            <small style={{ display: 'block', marginTop: '4px', color: '#37474F', opacity: '0.7' }}>
              Default: 100 Bytes
            </small>
            </div>
            
            <div 
              className="popup-actions"
              style={{
                marginTop: '24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}
            >
              <button 
                style={{
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  cursor: 'pointer'
                }}
                onClick={() => setIsPopupVisible(false)}
              >
                Cancel
              </button>
              <button 
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={handleChunks}
              >
                Process Chunks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
