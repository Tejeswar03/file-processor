import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export default async function handler(req, res) {
  const { format } = req.query;
  const validFormats = ['txt', 'csv', 'xlsx'];
  
  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format' });
  }
  
  try {
    // Generate a unique fileId
    const fileId = `${Date.now()}_${format}`;
    
    // Generate a random password for this download
    const password = crypto.randomBytes(8).toString('hex');
    
    // Create a download URL
    const downloadUrl = `/api/download-encrypted?fileId=${fileId}&format=${format}&password=${password}`;
    
    return res.status(200).json({
      url: downloadUrl,
      file_name: `sample.${format}`,
      password: password
    });
  } catch (error) {
    console.error('Error generating download:', error);
    return res.status(500).json({ error: 'Failed to generate download' });
  }
}