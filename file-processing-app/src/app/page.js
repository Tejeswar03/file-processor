'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FileUpload from '@/components/FileUpload';
import FileActions from '@/components/FileActions';
import ResultSection from '@/components/ResultSection';

// Dynamic import of utility modules
const loadModules = () => {
  // Import modules with try-catch blocks
  try {
    import('@/utils/FileRegular/index').then(module => {
      window.uploadFile = module;
      console.log('File regular module loaded successfully');
    }).catch(error => {
      console.error('Error loading filReg module:', error);
    });
  } catch (error) {
    console.error('Error importing fileReg module:', error);
  }
  
  try {
    import('@/utils/EncodingBase64/index').then(module => {
      window.base64Handler = module;
      console.log('Base64 Handler module loaded successfully');
    }).catch(error => {
      console.error('Error loading base64Handler module:', error);
    });
  } catch (error) {
    console.error('Error importing base64Handler module:', error);
  }
  
  try {
    import('@/utils/EncryptedAES/index').then(module => {
      window.encryptionHandler = module;
      console.log('Encryption Handler module loaded successfully');
    }).catch(error => {
      console.error('Error loading encryptionHandler module:', error);
    });
  } catch (error) {
    console.error('Error importing encryptionHandler module:', error);
  }
  
  try {
    import('@/utils/Chunked/index').then(module => {
      window.chunkHandler = module;
      console.log('Chunk Handler module loaded successfully');
    }).catch(error => {
      console.error('Error loading chunkHandler module:', error);
    });
  } catch (error) {
    console.error('Error importing chunkHandler module:', error);
  }
};

export default function Home() {
  const [currentFile, setCurrentFile] = useState(null);
  const [progressControls, setProgressControls] = useState(null);
  const [isResultVisible, setIsResultVisible] = useState(false);
  const [resultData, setResultData] = useState(null);

  // Load modules on component mount
  useEffect(() => {
    loadModules();
  }, []);

  return (
    <>
      <Header />
      <div className="container">
        <div className="app-container">
          <FileUpload 
            setCurrentFile={setCurrentFile} 
            updateProgress={setProgressControls} 
          />
          <FileActions 
            currentFile={currentFile}
            progressControls={progressControls} 
            setResultData={setResultData}
            setIsResultVisible={setIsResultVisible}
          />
        </div>
        <ResultSection 
          isVisible={isResultVisible} 
          resultData={resultData} 
        />
      </div>
      <Footer />
    </>
  );
}