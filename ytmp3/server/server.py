from flask import Flask, request, send_file, jsonify
from werkzeug.utils import secure_filename
import subprocess, os, uuid, shutil

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024 * 1024  # 1GB
UPLOAD_DIR = 'uploads'
OUTPUT_DIR = 'outputs'
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

ALLOWED_EXT = {'.mp4', '.mov', '.mkv', '.webm', '.avi', '.mp3', '.wav', '.m4a'}

def allowed(filename):
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXT

@app.post('/convert')
def convert():
    if 'file' not in request.files:
        return jsonify({'error': 'file is required'}), 400
    f = request.files['file']
    if f.filename == '':
        return jsonify({'error': 'filename is empty'}), 400
    if not allowed(f.filename):
        return jsonify({'error': 'unsupported file type'}), 415

    job_id = uuid.uuid4().hex
    in_name = secure_filename(f.filename)
    in_path = os.path.join(UPLOAD_DIR, f"{job_id}_{in_name}")
    out_path = os.path.join(OUTPUT_DIR, f"{job_id}.mp3")
    f.save(in_path)

    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', in_path,
            '-vn', '-acodec', 'libmp3lame',
            '-b:a', request.form.get('bitrate', '192k'),
            out_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return send_file(out_path, as_attachment=True, download_name=os.path.splitext(in_name)[0] + '.mp3')
    except subprocess.CalledProcessError as e:
        return jsonify({'error': 'conversion failed', 'detail': e.stderr.decode('utf-8', 'ignore')}), 500
    finally:
        # クリーンアップ（必要に応じて保持ポリシーを調整）
        try:
            os.remove(in_path)
        except Exception:
            pass

@app.get('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
