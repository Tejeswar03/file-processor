'use client';
import { useState } from 'react';

export default function FileActions({
  currentFile,
  progressControls,
  setResultData,
  setIsResultVisible
}) {
  const [chunkSize, setChunkSize] = useState(1048576); // Default: 1MB
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);

  // Mock server URLs (for display purposes)
  const serverUrls = {
    upload: 'https://linkanaccount.com/upload_websocket',
    regular: 'https://linkanaccount.com/upload_regular',
    encoded: 'https://linkanaccount.com/upload_encoded',
    encrypted: 'https://linkanaccount.com/upload_encrypted',
    chunked: 'https://linkanaccount.com/upload_chunked'
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
        content: result,
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
            onClick={currentFile ? handleChunks : null}
            onMouseOver={() => setIsOptionsVisible(true)}
            onMouseOut={() => {
              if (!document.activeElement ||
                !document.getElementById('optionsContainer')?.contains(document.activeElement)) {
                setIsOptionsVisible(false);
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

      <div
        id="optionsContainer"
        className="file-info"
        style={{
          display: isOptionsVisible && currentFile ? 'block' : 'none',
          marginTop: '16px'
        }}
      >
        <div className="form-group">
          <label htmlFor="chunkSizeInput" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
            Chunk Size (bytes):
          </label>
          <input
            type="number"
            id="chunkSizeInput"
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ECEFF1' }}
            value={chunkSize}
            onChange={(e) => setChunkSize(parseInt(e.target.value) || 1048576)}
          />
          <small style={{ display: 'block', marginTop: '4px', color: '#37474F', opacity: '0.7' }}>
            Default: 1MB (1048576 bytes)
          </small>
        </div>
      </div>
    </>
  );
}
