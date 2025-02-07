import os
import sys
from flask import Flask, jsonify, request
from flask_cors import CORS

# Add the parent directory to the sys.path to import backend module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ai import AI
import backend.parser as parser

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/hasApiKey', methods=['GET'])
def has_api_key():
    return jsonify({"hasApiKey": ai.has_api_key()}), 200

@app.route('/detectChapters', methods=['POST'])
def detect_chapters():
    if 'audiobook' not in request.files:
        return jsonify({"error": "audiobook is required"}), 400

    file = request.files['audiobook']

    chapters = parser.extract_chapter_headers(file.read())

    # Process the file and filename here
    # Stubbed response
    return jsonify({"chapters": chapters}), 200

@app.route('/generateChapters', methods=['POST'])
def generate_chapters():
    # Stubbed response
    return jsonify({"message": "generateChapters endpoint"}), 200

@app.route('/exportChapters', methods=['POST'])
def export_chapters():
    if 'file' not in request.files:
        return jsonify({"error": "file is required"}), 400
    if 'thumbnail' not in request.files:
        return jsonify({"error": "thumbnail is required"}), 400
    if not all(key in request.form for key in ('filename', 'chapters', 'title', 'author')):
        return jsonify({"error": "filename, chapters, title, and author are required"}), 400

    file = request.files['file']
    thumbnail = request.files['thumbnail']
    filename = request.form['filename']
    chapters = request.form['chapters']
    title = request.form['title']
    author = request.form['author']

    # Stubbed processing of the file, chapters, title, author, and thumbnail
    # ...

    # Save the thumbnail image
    thumbnail_path = os.path.join('thumbnails', thumbnail.filename)
    thumbnail.save(thumbnail_path)

    # Create a response file (stubbed content for now)
    response_content = f"Title: {title}\nAuthor: {author}\nChapters: {chapters}\nThumbnail: {thumbnail_path}\n"
    response_file = f"{filename}.txt"
    with open(response_file, 'w') as f:
        f.write(response_content)

    return jsonify({"message": "File created successfully", "filename": response_file}), 200

if __name__ == '__main__':
    print("Starting server...")
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    if not gemini_api_key:
        print("GEMINI_API_KEY environment variable not set")
    else:
        print("GEMINI_API_KEY found")
    ai = AI(gemini_api_key)
    app.run(port=8089, debug=True)