from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def hello():
    version = os.getenv('APP_VERSION', 'unknown')
    return jsonify({
        'message': 'Hello from my app!',
        'version': version
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)