import base64
from io import BytesIO
import json
import os
import sys
import tempfile
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# Add the parent directory to the sys.path to import backend module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.ai import AI
import backend.parser as parser

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

ai = None

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
    # Parse table of contents, audio file, and number of silences
    if not all(key in ['tableOfContents', 'numSilences', 'sampleRate'] and key in request.form for key in ('tableOfContents', 'numSilences')) or 'audioFile' not in request.files:
        return jsonify({"error": "tableOfContents, audioFile, sampleRate, and numSilences are required"}), 400
    
    audio_file = request.files['audioFile']
    audio_bytes = audio_file.read()
    num_silences = int(request.form['numSilences'])
    table_of_contents = json.loads(request.form['tableOfContents'])
    sample_rate = int(request.form['sampleRate'])

    print(f'Sample rate: {sample_rate}')
    print(f'Number of silences: {num_silences}')
    file_extension = os.path.splitext(audio_file.filename)[1]

    # make temporary file
    with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as audiobook_file:
        audiobook_path = audiobook_file.name
        audiobook_file.write(audio_bytes)
    try:
        # Add some extra silences to account for potential missed silences
        largest_silences = parser.find_largest_silences(audio_bytes, num_silences + 8, sample_rate, audiobook_path)
        print(f"Found {len(largest_silences)} largest silences")


        chapters = []
        chapter_index = 1

        if ai is None:
            print("No AI model found, using default chapter titles")

        # Create a separate temp file for each clip
        clip_file = tempfile.NamedTemporaryFile(suffix='.mp3', delete=False)
        clip_path = clip_file.name
        clip_file.close()

        for i, (end) in enumerate(largest_silences, 1):
            if ai is None:
                chapters.append({
                        'id': str(chapter_index),
                        'time': float(parser.parse_timestamp_from_hhmmssxx(end).total_seconds()), 
                        'title': f'Chapter {chapter_index}'
                    })
            else:
                parser.generate_clip(audiobook_path, end, clip_path)  # Overwrite the same file
                contains_chapter, chapter = ai.query_gemini(clip_path, table_of_contents)
                if contains_chapter:
                    print(f"Chapter found: {chapter} ({end})")
                    chapters.append({
                        'id': str(chapter_index),
                        'time': float(parser.parse_timestamp_from_hhmmssxx(end).total_seconds()),
                        'title': chapter
                    })
            chapter_index += 1
    finally:
        # Clean up the temporary file
        os.remove(audiobook_path)

    print(f"Chapters: {chapters}")
    return jsonify(chapters), 200

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
    filename = request.form['filename'] # TODO: remove can use file.filename??
    chapters = json.loads(request.form['chapters'])
    title = request.form['title']
    author = request.form['author']

    file_bytes = file.stream.read()

    metadata_string = parser.construct_metadata(chapters, title, author, parser.get_audio_length(file_bytes))
    output_bytes = parser.merge_metadata_with_audio(file_bytes, metadata_string, thumbnail.stream.read())

    output_stream = BytesIO(output_bytes)
    output_stream.seek(0)

    # split the filename and extension, then return name + .m4b
    download_name = os.path.splitext(filename)[0] + ".m4b"

    return send_file(output_stream, as_attachment=True, download_name=download_name, mimetype="audio/m4b")

print("Starting server...")
gemini_api_key = os.getenv('GEMINI_API_KEY')
if not gemini_api_key:
    print("GEMINI_API_KEY environment variable not set")
else:
    print("GEMINI_API_KEY found")
    ai = AI(gemini_api_key)
app.run(port=8089, debug=True)