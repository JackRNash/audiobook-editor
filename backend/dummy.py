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
    
    chapter_headers = extract_chapter_headers(file_bytes)
    print(chapter_headers)