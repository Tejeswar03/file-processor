from flask import Flask, request, jsonify
import base64
import os
import json
import logging
import shutil
import hashlib
import zipfile
from werkzeug.utils import secure_filename
import tempfile
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from datetime import datetime
import eventlet
eventlet.monkey_patch()  # Important for Socket.IO to work with Flask
from flask_socketio import SocketIO, emit


app = Flask(__name__)
from flask_cors import CORS

CORS(app)  # Enable CORS for all routes
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Configure storage directory - change this to your preferred location
STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
CHUNKS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chunks')

# Ensure storage directories exist
for directory in [STORAGE_DIR, CHUNKS_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)
        logger.info(f"Created directory at {directory}")

# Encryption key - in production, store this securely!
# For demo purposes, we're hardcoding it
ENCRYPTION_KEY = b'VGhpc0lzQVNlY3JldEtleUZvckRlbW9Pbmx5ISEh=='  # Base64 encoded key

# WebRTC connection rooms
webrtc_rooms = {}

# Socket.IO event handlers for WebRTC signaling
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    emit('connection_established', {'message': 'Connected to WebRTC signaling server'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")
    # Clean up any rooms this client was in
    for room_id, clients in list(webrtc_rooms.items()):
        if request.sid in clients:
            clients.remove(request.sid)
            if len(clients) == 0:
                del webrtc_rooms[room_id]

@socketio.on('join_room')
def handle_join_room(data):
    room_id = data.get('room')
    if not room_id:
        emit('error', {'message': 'Room ID is required'})
        return
    
    if room_id not in webrtc_rooms:
        webrtc_rooms[room_id] = []
    
    webrtc_rooms[room_id].append(request.sid)
    logger.info(f"Client {request.sid} joined room {room_id}")
    emit('room_joined', {'room': room_id})

@socketio.on('webrtc_offer')
def handle_offer(data):
    room_id = data.get('room')
    offer = data.get('offer')
    
    if not room_id or not offer or room_id not in webrtc_rooms:
        emit('error', {'message': 'Invalid offer data'})
        return
    
    # Forward offer to all other clients in the room
    for client_id in webrtc_rooms[room_id]:
        if client_id != request.sid:
            socketio.emit('webrtc_offer', {
                'offer': offer,
                'from': request.sid
            }, room=client_id)

@socketio.on('webrtc_answer')
def handle_answer(data):
    room_id = data.get('room')
    answer = data.get('answer')
    target = data.get('target')
    
    if not room_id or not answer or not target or room_id not in webrtc_rooms:
        emit('error', {'message': 'Invalid answer data'})
        return
    
    # Send answer to specific client
    socketio.emit('webrtc_answer', {
        'answer': answer,
        'from': request.sid
    }, room=target)

@socketio.on('webrtc_ice_candidate')
def handle_ice_candidate(data):
    room_id = data.get('room')
    candidate = data.get('candidate')
    target = data.get('target')
    
    if not room_id or not candidate or room_id not in webrtc_rooms:
        emit('error', {'message': 'Invalid ICE candidate data'})
        return
    
    # If target is specified, send only to that client
    if target:
        socketio.emit('webrtc_ice_candidate', {
            'candidate': candidate,
            'from': request.sid
        }, room=target)
    else:
        # Otherwise, broadcast to all other clients in the room
        for client_id in webrtc_rooms[room_id]:
            if client_id != request.sid:
                socketio.emit('webrtc_ice_candidate', {
                    'candidate': candidate,
                    'from': request.sid
                }, room=client_id)

# REST endpoints for file uploads (existing code below)

@app.route('/upload_encoded', methods=['POST'])
def upload_file():
    """
    Endpoint for receiving and storing base64 encoded files
    """
    try:
        # Get data from request
        data = request.json
        
        if not data or 'fileData' not in data or 'filename' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing required fields (filename, fileData)'
            }), 400
        
        # Extract file information
        filename = data['filename']
        file_data = data['fileData']
        
        # Generate a unique filename to avoid collisions
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(STORAGE_DIR, unique_filename)
        
        # Decode base64 data
        try:
            decoded_data = base64.b64decode(file_data)
        except Exception as e:
            logger.error(f"Error decoding base64 data: {e}")
            return jsonify({
                'success': False,
                'message': f'Invalid base64 data: {str(e)}'
            }), 400
        
        # Write file to disk
        with open(file_path, 'wb') as f:
            f.write(decoded_data)
        
        file_size = os.path.getsize(file_path)
        logger.info(f"Saved file: {unique_filename} ({file_size} bytes)")
        
        return jsonify({
            'success': True,
            'message': 'File received and saved successfully',
            'filename': unique_filename,
            'size': file_size,
            'path': file_path
        })
        
    except Exception as e:
        logger.error(f"Error processing upload: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/upload_chunked', methods=['POST'])
def chunk_upload_file():
    """
    Endpoint for receiving and storing base64 encoded files in chunks
    """
    try:
        # Get data from request
        data = request.json
        
        if not data or 'chunkData' not in data or 'filename' not in data or 'chunkIndex' not in data or 'totalChunks' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing required fields (filename, chunkData, chunkIndex, totalChunks)'
            }), 400
        
        # Extract chunk information
        filename = data['filename']
        chunk_data = data['chunkData']
        chunk_index = int(data['chunkIndex'])
        total_chunks = int(data['totalChunks'])
        file_id = data.get('fileId', filename)  # Use provided fileId or fallback to filename
        
        # Create a directory for this file's chunks if it doesn't exist
        file_chunks_dir = os.path.join(CHUNKS_DIR, file_id)
        if not os.path.exists(file_chunks_dir):
            os.makedirs(file_chunks_dir)
            
        # Save metadata if this is the first chunk
        if chunk_index == 0:
            metadata = {
                'filename': filename,
                'totalChunks': total_chunks,
                'receivedChunks': 0,
                'startTime': datetime.now().isoformat()
            }
            with open(os.path.join(file_chunks_dir, '_metadata.json'), 'w') as f:
                json.dump(metadata, f)
                
        # Decode and save this chunk
        try:
            decoded_chunk = base64.b64decode(chunk_data)
        except Exception as e:
            logger.error(f"Error decoding base64 chunk data: {e}")
            return jsonify({
                'success': False,
                'message': f'Invalid base64 data in chunk: {str(e)}'
            }), 400
            
        # Save the chunk
        chunk_path = os.path.join(file_chunks_dir, f'chunk_{chunk_index:05d}')
        with open(chunk_path, 'wb') as f:
            f.write(decoded_chunk)
            
        # Update metadata
        metadata_path = os.path.join(file_chunks_dir, '_metadata.json')
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
            
        metadata['receivedChunks'] = metadata.get('receivedChunks', 0) + 1
        metadata['lastChunkTime'] = datetime.now().isoformat()
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)
            
        # Check if all chunks are received
        if metadata['receivedChunks'] >= total_chunks:
            # Reassemble the file
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            unique_filename = f"{timestamp}_{filename}"
            output_path = os.path.join(STORAGE_DIR, unique_filename)
            
            with open(output_path, 'wb') as outfile:
                for i in range(total_chunks):
                    chunk_path = os.path.join(file_chunks_dir, f'chunk_{i:05d}')
                    if os.path.exists(chunk_path):
                        with open(chunk_path, 'rb') as infile:
                            outfile.write(infile.read())
                    else:
                        logger.error(f"Missing chunk {i} for file {file_id}")
                        return jsonify({
                            'success': False,
                            'message': f'Missing chunk {i} during reassembly'
                        }), 500
            
            # Clean up chunks directory
            shutil.rmtree(file_chunks_dir)
            
            file_size = os.path.getsize(output_path)
            logger.info(f"Reassembled chunked file: {unique_filename} ({file_size} bytes)")
            
            return jsonify({
                'success': True,
                'message': 'File chunks received and reassembled successfully',
                'filename': unique_filename,
                'size': file_size,
                'path': output_path,
                'completed': True
            })
        else:
            # Return progress
            return jsonify({
                'success': True,
                'message': f'Chunk {chunk_index + 1}/{total_chunks} received successfully',
                'filename': filename,
                'progress': metadata['receivedChunks'] / total_chunks,
                'completed': False
            })
            
    except Exception as e:
        logger.error(f"Error processing chunk upload: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/upload_encrypted', methods=['POST'])
def zip_encrypted_upload_file():
    """
    Endpoint for receiving and storing encrypted zip files
    """
    try:
        # Get data from request
        data = request.json
        
        if not data or 'encryptedData' not in data or 'filename' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing required fields (filename, encryptedData)'
            }), 400
        
        # Extract file information
        filename = data['filename']
        encrypted_data = data['encryptedData']
        
        # Generate a unique filename to avoid collisions
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        encrypted_path = os.path.join(STORAGE_DIR, f"encrypted_{unique_filename}")
        
        # Decode base64 data
        try:
            decoded_data = base64.b64decode(encrypted_data)
        except Exception as e:
            logger.error(f"Error decoding base64 data: {e}")
            return jsonify({
                'success': False,
                'message': f'Invalid base64 data: {str(e)}'
            }), 400
        
        # Save the encrypted data temporarily
        with open(encrypted_path, 'wb') as f:
            f.write(decoded_data)
            
        # Decrypt the data
        try:
            # Read encrypted data from file
            with open(encrypted_path, 'rb') as f:
                encrypted_data = f.read()
            
            # First 16 bytes are the IV, rest is the encrypted data
            iv = encrypted_data[:16]
            actual_encrypted_data = encrypted_data[16:]
            
   
            key_material = base64.b64decode(ENCRYPTION_KEY)
            key = hashlib.sha256(key_material).digest()
            
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
            decryptor = cipher.decryptor()
            
            decrypted_data = decryptor.update(actual_encrypted_data) + decryptor.finalize()
            
            # Create temporary directory for extraction
            with tempfile.TemporaryDirectory() as temp_dir:
                # Save decrypted zip
                decrypted_zip_path = os.path.join(temp_dir, f"decrypted_{unique_filename}.zip")
                with open(decrypted_zip_path, 'wb') as f:
                    f.write(decrypted_data)
                
                # Extract zip
                extract_dir = os.path.join(STORAGE_DIR, f"extracted_{timestamp}_{filename.split('.')[0]}")
                with zipfile.ZipFile(decrypted_zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                
                # Get list of extracted files
                extracted_files = []
                for root, _, files in os.walk(extract_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        relative_path = os.path.relpath(file_path, extract_dir)
                        file_size = os.path.getsize(file_path)
                        extracted_files.append({
                            'name': relative_path,
                            'size': file_size
                        })
                
                # Remove the temporary encrypted file
                os.remove(encrypted_path)
                
                logger.info(f"Processed encrypted zip: {unique_filename}, extracted {len(extracted_files)} files")
                
                return jsonify({
                    'success': True,
                    'message': 'Encrypted zip received, decrypted, and extracted successfully',
                    'zipFilename': unique_filename,
                    'extractionDir': extract_dir,
                    'extractedFiles': extracted_files
                })
                
        except Exception as e:
            logger.error(f"Error decrypting or extracting zip: {e}")
            # Clean up
            if os.path.exists(encrypted_path):
                os.remove(encrypted_path)
                
            return jsonify({
                'success': False,
                'message': f'Error processing encrypted zip: {str(e)}'
            }), 500
            
    except Exception as e:
        logger.error(f"Error processing encrypted zip upload: {e}")
        return jsonify({
            'success': False,
            'message': f'Server error: {str(e)}'
        }), 500



@app.route('/upload_webrtc', methods=['POST'])
def upload_webrtc():
    """
    Simple HTTP upload endpoint for WebRTC demo clients.
    Expects a multipart/form-data POST with key="file".
    """
    # 1) Check if file part is present
    if 'file' not in request.files:
        return jsonify(success=False, message="No file part in request"), 400

    file = request.files['file']

    # 2) Check a file was actually selected
    if file.filename == '':
        return jsonify(success=False, message="No selected file"), 400

    # 3) Secure the filename and save
    filename = secure_filename(file.filename)
    save_path = os.path.join(STORAGE_DIR, filename)
    try:
        file.save(save_path)
    except Exception as e:
        logger.error(f"Error saving uploaded file: {e}")
        return jsonify(success=False, message=f"Failed to save file: {e}"), 500

    # 4) Return metadata
    file_size = os.path.getsize(save_path)
    logger.info(f"Received file via WebRTC demo: {filename} ({file_size} bytes)")
    return jsonify(
        success=True,
        filename=filename,
        size=file_size,
        path=save_path
    ), 200

if __name__ == '__main__':
    # For production, consider using a proper WSGI server like Gunicorn
    logger.info(f"Starting server on port 5001, files will be stored in {STORAGE_DIR}")
    # Don't use app.run() with Socket.IO, use socketio.run() instead
    socketio.run(app, host='0.0.0.0', port=5001, debug=False)