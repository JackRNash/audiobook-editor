import base64
from io import BytesIO
import json
import os
import sys
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# Add the parent directory to the sys.path to import backend module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ai import AI
import backend.parser as parser

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/hasApiKey', methods=['GET'])
def has_api_key():
    return jsonify({"hasApiKey": ai.has_api_key()}), 200

@app.route('/detectChapters', methods=['POST'])
def detect_chapters():
    if 'audiobook' not in request.files:
        return jsonify({"error": "audiobook is required"}), 400

    file = request.files['audiobook']
    file_bytes = file.read()
    metadata = parser.extract_chapter_headers(file_bytes)

    try:
        thumbnail_bytes = parser.extract_thumbnail(file_bytes)
    except Exception as e:
        thumbnail_bytes = None
        print(f"Error extracting thumbnail: {e}")

    response_data = {
        "chapters": metadata['chapters'],
        "title": metadata['title'],
        "author": metadata['author']
    }

    if thumbnail_bytes:
        thumbnail_base64 = base64.b64encode(thumbnail_bytes).decode('utf-8')
        response_data["thumbnail"] = thumbnail_base64

    return jsonify(response_data), 200

@app.route('/generateChapters', methods=['POST'])
def generate_chapters():
    # Stubbed response
    return jsonify({"message": "generateChapters endpoint"}), 200

@app.route('/exportChapters', methods=['POST'])
def export_chapters():
    if 'file' not in request.files:
        return jsonify({"error": "file is required"}), 400
    # if 'thumbnail' not in request.files:
    #     return jsonify({"error": "thumbnail is required"}), 400
    if not all(key in request.form for key in ('filename', 'chapters', 'title', 'author')):
        return jsonify({"error": "filename, chapters, title, and author are required"}), 400

    file = request.files['file']
    # thumbnail = request.files['thumbnail']
    filename = request.form['filename'] # TODO: remove can use file.filename??
    chapters = json.loads(request.form['chapters'])
    title = request.form['title']
    author = request.form['author']

    file_bytes = file.stream.read()

    # Create the "tmp" folder if it doesn't exist
    tmp_folder = "tmp"
    os.makedirs(tmp_folder, exist_ok=True)

    # output_file = os.path.join(tmp_folder, f"{filename}.m4b")
    metadata_string = parser.construct_metadata(chapters, title, author, parser.get_audio_length(file_bytes))
    output_bytes = parser.merge_metadata_with_audio(file_bytes, file.filename, metadata_string)

    # # Save the thumbnail image
    # thumbnail_path = os.path.join('thumbnails', thumbnail.filename)
    # thumbnail.save(thumbnail_path)

    # # Create a response file (stubbed content for now)
    # response_content = f"Title: {title}\nAuthor: {author}\nChapters: {chapters}\nThumbnail: {thumbnail_path}\n"
    # response_file = f"{filename}.txt"
    # with open(response_file, 'w') as f:
    #     f.write(response_content)

    output_stream = BytesIO(output_bytes)
    output_stream.seek(0)

    # split the filename and extension, then return name + .m4b
    download_name = os.path.splitext(filename)[0] + ".m4b"

    return send_file(output_stream, as_attachment=True, download_name=download_name, mimetype="audio/m4b")

if __name__ == '__main__':
    print("Starting server...")
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    if not gemini_api_key:
        print("GEMINI_API_KEY environment variable not set")
    else:
        print("GEMINI_API_KEY found")
    ai = AI(gemini_api_key)
    app.run(port=8089, debug=True)