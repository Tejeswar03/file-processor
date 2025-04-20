import http.server
import ssl
import os

# Set server port
port = 8000

# Define handler
handler = http.server.SimpleHTTPRequestHandler

# Create server
server = http.server.HTTPServer(('localhost', port), handler)

# Set up SSL
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('localhost+1.pem', 'localhost+1-key.pem')
server.socket = context.wrap_socket(server.socket, server_side=True)

# Start server
print(f"Server started at https://localhost:{port}")
server.serve_forever()