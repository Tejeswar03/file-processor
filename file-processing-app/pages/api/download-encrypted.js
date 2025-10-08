import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export default async function handler(req, res) {
  const { fileId, format, password } = req.query;
  const validFormats = ['txt', 'csv', 'xlsx'];
  
  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }
  
  try {
    // Get the file
    const fileName = `sample.${format}`;
    const filePath = path.join(process.cwd(), 'public', 'sample_files', fileName);
    const fileContent = fs.readFileSync(filePath);
    
    // Derive key using PBKDF2
    const salt = Buffer.from('salt_1234567890', 'utf8');
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Generate random IV
    const iv = crypto.randomBytes(16);
    
    // Encrypt file content
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(fileContent);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Prepend IV to encrypted content
    const finalEncrypted = Buffer.concat([iv, encrypted]);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="encrypted_${fileName}"`);
    
    return res.send(finalEncrypted);
  } catch (error) {
    console.error('Error serving encrypted file:', error);
    return res.status(500).json({ error: 'Failed to serve encrypted file' });
  }
}