'use client';
import { useRef } from 'react';

export default function ResultSection({ isVisible, resultData }) {
  const resultContentRef = useRef(null);
  
  const handleCopy = () => {
    if (resultContentRef.current) {
      navigator.clipboard.writeText(resultContentRef.current.textContent)
        .then(() => {
          const copyBtn = document.getElementById('copyBtn');
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 2000);
        });
    }
  };
  
  const handleDownload = () => {
    if (!resultContentRef.current || !resultData) return;
    
    const blob = new Blob([resultContentRef.current.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `result.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  if (!isVisible || !resultData) return null;
  
  return (
    <div className="result-section card visible" id="resultSection">
      <div className="section-title">
        <i className="fas fa-poll-h"></i>
        <span id="resultTitleHeader">{resultData.title || 'Results'}</span>
      </div>
      <div className="result-container">
        <div className="result-header">
          <div className="result-title" id="resultTitle">
            <i className={`fas fa-${resultData.icon || 'file-alt'}`}></i> 
            {resultData.title || 'Process Result'}
          </div>
          <div className="result-actions">
            <button className="btn btn-outline" id="copyBtn" onClick={handleCopy}>
              <i className="fas fa-copy"></i> Copy
            </button>
            <button className="btn btn-primary" id="downloadBtn" onClick={handleDownload}>
              <i className="fas fa-download"></i> Download
            </button>
          </div>
        </div>
        <pre className="result-content" id="resultContent" ref={resultContentRef}>
          {resultData.content}
        </pre>
      </div>
    </div>
  );
}