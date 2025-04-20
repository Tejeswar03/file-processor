export async function processAndUploadFile(
    file,
    signalingUrl = 'ws://localhost:5001',
    iceServers = [{ urls: 'stun:stun.l.google.com:19302' }],
    progressCallback
  ) {

    console.log('Processing and uploading file:', file);
    if (!file) {
      throw new Error('No file provided');
    }
    if (progressCallback) progressCallback(5);

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(signalingUrl);
      let pc;
      let channel;
  
      ws.onopen = () => {
        if (progressCallback) progressCallback(15);
        pc = new RTCPeerConnection({ iceServers });
        channel = pc.createDataChannel('fileUpload');
        setupChannelEvents(channel, file, progressCallback, resolve, reject);
  
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            ws.send(JSON.stringify({ type: 'candidate', candidate }));
          }
        };
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => ws.send(JSON.stringify({ type: 'offer', offer: pc.localDescription })))
          .catch(err => reject(new Error('Offer error: ' + err.message)));
      };
  
      ws.onmessage = async ({ data }) => {
        const msg = JSON.parse(data);
        try {
          if (msg.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          } else if (msg.type === 'candidate') {
            await pc.addIceCandidate(msg.candidate);
          }
        } catch (err) {
          console.error('Signaling error:', err);
        }
      };
  
      ws.onerror = err => reject(new Error('WebSocket error: ' + err.message));
      ws.onclose = () => console.log('WebSocket closed');
    });
  
    if (progressCallback) progressCallback(70);
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch('http://localhost:5001/upload_webrtc', {
      method: 'POST',
      body: form
    });
    if (!response.ok) {
      throw new Error(`HTTP upload failed: ${response.statusText}`);
    }
    if (progressCallback) progressCallback(100);
  }
  
  
  function setupChannelEvents(channel, file, progressCallback, resolve, reject) {
    channel.onopen = () => {
      readFileAndSend(channel, file, progressCallback)
        .then(() => {
          channel.send(JSON.stringify({ done: true }));
          resolve();
        })
        .catch(err => reject(err));
    };
    channel.onerror = err => reject(new Error('DataChannel error: ' + err.message));
    channel.onclose = () => console.log('DataChannel closed');
  }

  function readFileAndSend(channel, file, progressCallback) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result;
        const total = buffer.byteLength;
        const chunkSize = 16 * 1024;
        let offset = 0;
        while (offset < total) {
          const slice = buffer.slice(offset, offset + chunkSize);
          channel.send(slice);
          offset += chunkSize;
          if (progressCallback) {
            const pct = 15 + Math.round((offset / total) * 55);
            progressCallback(Math.min(pct, 70));
          }
        }
        resolve();
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.onprogress = e => {
        if (e.lengthComputable && progressCallback) {
          const pct = 15 + Math.round((e.loaded / e.total) * 40);
          progressCallback(pct);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  