import json
import requests
from parser import extract_chapter_headers
import sys
import os

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python dummy.py <audio_file_path>")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    
    with open(audio_file_path, 'rb') as f:
        file_bytes = f.read()
    
    # Send a message to the backend to export chapters
    # Extract chapter headers
    metadata = extract_chapter_headers(file_bytes)

    metadata['chapters'][0]['title'] = 'FAKE'

    # Prepare the data to send to the backend
    files = {
        'file': (os.path.basename(audio_file_path), file_bytes, 'audio/m4b')
    }
    data = {
        'title': metadata['title'],
        'author': metadata['author'],
        'filename': os.path.basename(audio_file_path),
        'chapters': json.dumps(metadata['chapters'])
    }
    
    # Send a message to the backend to export chapters
    response = requests.post('http://127.0.0.1:8089/exportChapters', files=files, data=data)

    # save to output.m4b
    with open('output.m4b', 'wb') as f:
        f.write(response.content)

    # Re extract chapter headers
    new_metadata = extract_chapter_headers(response.content)
    
    print(new_metadata['author'])

    if response.status_code == 200 and new_metadata['chapters'][0]['title'] == 'FAKE':
        print("Chapters exported successfully.")
    else:
        print(f"Failed to export chapters. Status code: {response.status_code}, Chapter Title: {new_metadata['chapters'][0]['title']}")
    