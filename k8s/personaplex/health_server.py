#!/usr/bin/env python3
"""
Health check endpoint for PersonaPlex K8s deployment.
Runs alongside the main Moshi server.
"""

from flask import Flask, jsonify
import threading
import time

app = Flask(__name__)

# Track server status
server_ready = False
last_heartbeat = time.time()

@app.route('/health')
def health():
    """Kubernetes liveness/readiness probe endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'personaplex',
        'timestamp': time.time()
    }), 200

@app.route('/ready')
def ready():
    """Readiness check - returns 200 when model is loaded."""
    if server_ready:
        return jsonify({'status': 'ready'}), 200
    return jsonify({'status': 'loading'}), 503

def run_health_server():
    """Run Flask health server on separate port."""
    app.run(host='0.0.0.0', port=8999, threaded=True)

if __name__ == '__main__':
    # When run directly, start health server
    run_health_server()
