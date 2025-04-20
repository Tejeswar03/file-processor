#!/usr/bin/env node

/**
 * Command Line Tool for File Uploads
 * 
 * Usage: node upload-cli.js <mode> <file-path> <server-url> [options]
 * 
 * Modes:
 *   regular   - Regular file upload (base64 encoded)
 *   chunked   - Chunked file upload
 *   encrypted - Create encrypted zip and upload
 * 
 * Examples:
 *   node upload-cli.js regular ./test.txt http://localhost:5001/upload_encoded
 *   node upload-cli.js chunked ./large-file.iso http://localhost:5001/upload_chunked --chunk-size=2097152
 *   node upload-cli.js encrypted ./sensitive-folder http://localhost:5001/upload_zip_encrypted
 */

const { processAndUploadFile } = require('./EncodingBase64/index');
const { uploadFileInChunks } = require('./Chunked/index');
const { processAndUploadEncrypted } = require('./EncryptedAES/index');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

// Extract options (starting with --)
const cleanArgs = args.filter(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=');
    options[key] = value;
    return false;
  }
  return true;
});

// Show help if insufficient arguments
if (cleanArgs.length < 3) {
  console.log('File Upload CLI Tool\n');
  console.log('Usage: node upload-cli.js <mode> <file-path> <server-url> [options]\n');
  console.log('Modes:');
  console.log('  regular   - Regular file upload (base64 encoded)');
  console.log('  chunked   - Chunked file upload');
  console.log('  encrypted - Create encrypted zip and upload\n');
  console.log('Examples:');
  console.log('  node upload-cli.js regular ./test.txt http://localhost:5001/upload_encoded');
  console.log('  node upload-cli.js chunked ./large-file.iso http://localhost:5001/upload_chunked --chunk-size=2097152');
  console.log('  node upload-cli.js encrypted ./sensitive-folder http://localhost:5001/upload_encrypted\n');
  console.log('Options:');
  console.log('  --chunk-size=<bytes>  - Size of chunks in bytes (default: 1MB)');
  process.exit(1);
}

const mode = cleanArgs[0].toLowerCase();
const filePath = cleanArgs[1];
const serverUrl = cleanArgs[2];

// Handle progress updates
const progressHandler = (progress) => {
  const percentBar = '='.repeat(Math.floor(progress.percentComplete / 2)) + '>';
  process.stdout.write(`\rProgress: [${percentBar.padEnd(50)} ] ${progress.percentComplete}% - Chunk ${progress.currentChunk}/${progress.totalChunks}`);
};

console.log(`Starting upload process...`);
console.log(`Mode: ${mode}`);
console.log(`File/Directory: ${filePath}`);
console.log(`Server: ${serverUrl}`);
console.log(`Options: ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`);
console.log('');

// Choose upload method based on mode
let uploadPromise;

switch (mode) {
  case 'regular':
    uploadPromise = processAndUploadFile(filePath, serverUrl);
    break;
    
  case 'chunked':
    const chunkSize = options['chunk-size'] ? parseInt(options['chunk-size']) : 1024 * 1024;
    console.log(`Using chunk size: ${chunkSize} bytes`);
    uploadPromise = uploadFileInChunks(filePath, serverUrl, chunkSize, progressHandler);
    break;
    
  case 'encrypted':
    uploadPromise = processAndUploadEncrypted(filePath, serverUrl);
    break;
    
  default:
    console.error(`Unknown mode: ${mode}`);
    console.error('Valid modes: regular, chunked, encrypted');
    process.exit(1);
}

// Process the upload
uploadPromise
  .then(result => {
    if (result.success) {
      console.log('\n✅ Success!');
      console.log(result.message);
      if (result.response) {
        console.log('\nServer response:');
        console.log(JSON.stringify(result.response, null, 2));
      }
      process.exit(0);
    } else {
      console.error('\n❌ Failed!');
      console.error(result.message);
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n❌ Error occurred:');
    console.error(err);
    process.exit(1);
  });
