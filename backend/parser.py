from io import BytesIO
import json
import logging
import os
import sys
import subprocess
import tempfile
import numpy as np
from datetime import timedelta
from tqdm import tqdm
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content


def extract_audio_data(file_path):
    command = [
        'ffmpeg', '-i', file_path, '-f', 'wav', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1'
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, _ = process.communicate()
    return np.frombuffer(stdout, dtype=np.int16)

def extract_chapter_headers(file_bytes):
    command = [
        'ffmpeg', '-i', 'pipe:0', '-f', 'ffmetadata', '-'
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, _ = process.communicate(input=file_bytes)
    metadata = stdout.decode('utf-8')
    
    chapter_headers = []
    current_chapter = {}
    chapter_id = 1
    title = "Untitled Audiobook"
    author = "Unknown Author"
    seen_chapter = False
    
    for line in metadata.split('\n'):
        if line.startswith('title=') and not seen_chapter:
            title = line.split('=', 1)[1]
        elif line.startswith('artist='):
            author = line.split('=', 1)[1]
        elif line.startswith('[CHAPTER]'):
            seen_chapter = True
            if 'title' in current_chapter and 'start' in current_chapter:
                chapter_headers.append({
                    'id': str(chapter_id),
                    'time': current_chapter['start'],
                    'title': current_chapter['title']
                })
                chapter_id += 1
            current_chapter = {}
        elif line.startswith('TIMEBASE='):
            timebase = line.split('=', 1)[1]
            timebase_num, timebase_den = map(int, timebase.split('/'))
            timebase_factor = timebase_num / timebase_den
        elif line.startswith('START='):
            start_time = int(line.split('=', 1)[1])
            current_chapter['start'] = start_time * timebase_factor
        elif line.startswith('title='):
            current_chapter['title'] = line.split('=', 1)[1]
    
    # Ensure the last chapter is added if the metadata does not end with an empty line
    if 'title' in current_chapter and 'start' in current_chapter:
        chapter_headers.append({
            'id': str(chapter_id),
            'time': current_chapter['start'],
            'title': current_chapter['title']
        })
    
    return {
        "chapters": chapter_headers,
        "title": title,
        "author": author
    }

def extract_thumbnail(file_bytes):
    with tempfile.NamedTemporaryFile(delete=False) as audio_temp:
        audio_temp.write(file_bytes)
        audio_temp.flush()
        audio_temp_path = audio_temp.name

    try:
        command = [
            'ffmpeg', '-y', '-i', audio_temp_path, '-an', '-vcodec', 'copy', '-f', 'image2', 'pipe:1'
        ]
        
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg error: {stderr.decode('utf-8')}")
        
        return stdout
    finally:
        os.remove(audio_temp_path)

def find_silences(audio_data, silence_threshold, min_silence_len):
    silence_samples = []
    current_silence_start = None
    for i, sample in tqdm(enumerate(audio_data), total=len(audio_data), desc="Finding silences"):
        if abs(sample) < silence_threshold:
            if current_silence_start is None:
                current_silence_start = i
        else:
            if current_silence_start is not None:
                silence_duration = i - current_silence_start
                if silence_duration >= min_silence_len:
                    silence_samples.append((current_silence_start, i))
                current_silence_start = None
    return silence_samples

def find_largest_silences(audio_data, num_silences):
    sample_rate = 16000 # TODO: Get this from the audio file
    silence_threshold = 500  # Adjust this threshold as needed
    min_silence_len = sample_rate  # 1 second of silence

    # audio_data = extract_audio_data(file_path)
    silences = find_silences(audio_data, silence_threshold, min_silence_len)
    
    # Calculate the duration of each silence period
    silence_durations = [(start, end, end - start) for start, end in silences]
    
    # Sort by duration and get the X largest periods of silence
    largest_silences = sorted(silence_durations, key=lambda x: x[2], reverse=True)[:num_silences]

    # Sort the largest silences chronologically
    largest_silences = sorted(largest_silences, key=lambda x: x[0])
    
    # Convert sample indices to timestamps
    # largest_silences = [(str(timedelta(seconds=start / sample_rate)), str(timedelta(seconds=end / sample_rate))) for start, end, _ in largest_silences]
    largest_silences = [(str(timedelta(seconds=end / sample_rate))) for start, end, _ in largest_silences]
    
    return largest_silences

def generate_clip(input_file, timestamp, output_file):
    command = [
        'ffmpeg', '-y', '-i', input_file, '-ss', timestamp, '-t', '10', output_file
    ]
    subprocess.run(command)

def parse_timestamp(timestamp):
    # hours, minutes, seconds = map(float, timestamp.split(':'))
    # return timedelta(hours=hours, minutes=minutes, seconds=seconds)
    seconds = float(timestamp)
    return timedelta(seconds=seconds)

def construct_metadata(chapters, title, author, total_length_placeholder):
    metadata = ";FFMETADATA1\n"
    metadata += f"title={title}\n"
    metadata += f"artist={author}\n\n"

    for i, chapter in enumerate(chapters):
        start = 0 if i == 0 else int(parse_timestamp(chapter['time']).total_seconds() * 1000)
        end = int(parse_timestamp(chapters[i+1]['time']).total_seconds() * 1000) if i < len(chapters) - 1 else int(total_length_placeholder.total_seconds() * 1000)
        metadata += f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={start}\nEND={end}\ntitle={chapter['title']}\n\n"

    return metadata

def merge_metadata_with_audio(input_audio_stream, metadata_str, thumbnail_bytes=None):
    # Thumbnail present?
    if thumbnail_bytes:
        print('Thumbnail detected')
    else:
        print('No thumbnail detected')
    
    with tempfile.NamedTemporaryFile(delete=False) as audio_temp, tempfile.NamedTemporaryFile(delete=False) as metadata_temp, tempfile.NamedTemporaryFile(delete=False, suffix='.m4b') as output_temp:
        audio_temp.write(input_audio_stream)
        metadata_temp.write(metadata_str.encode('utf-8'))
        audio_temp.flush()
        metadata_temp.flush()
        
        audio_temp_path = audio_temp.name
        metadata_temp_path = metadata_temp.name
        output_temp_path = output_temp.name
    
    try:
        # if input_extension == '.m4b':
        # For M4B files, we can avoid transcoding and just copy the audio stream
        command = [
            'ffmpeg', '-y',
            '-i', audio_temp_path,
            '-i', metadata_temp_path
        ]
        
        if thumbnail_bytes:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as cover_temp_file:
                cover_temp_file.write(thumbnail_bytes)
                cover_temp_file.flush()
                cover_temp_path = cover_temp_file.name
                command.extend(['-i', cover_temp_path])

        # Base mapping and codec options
        command.extend([
            '-map', '0:a',  # Map audio from first input
            '-map_metadata', '1',  # Map metadata from second input
            '-map_chapters', '1'  # Map chapters from second input
        ])

        if thumbnail_bytes:
            command.extend([
                '-map', '2',  # Map image from third input
                '-disposition:v', 'attached_pic',  # Set as cover art
                '-metadata:s:v', 'title="Album cover"',
                '-metadata:s:v', 'comment="Cover (front)"'
            ])

        # Output options
        command.extend([
            '-c:a', 'copy',  # Copy audio codec
            '-c:v', 'mjpeg' if thumbnail_bytes else 'copy',  # Use MJPEG for cover
            output_temp_path
        ])
        
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg error: {stderr.decode('utf-8')}")
        
        with open(output_temp_path, 'rb') as f:
            output_bytes = f.read()
        
        return output_bytes
    finally:
        os.remove(audio_temp_path)
        os.remove(metadata_temp_path)
        os.remove(output_temp_path)
        if 'cover_temp_path' in locals():
            os.remove(cover_temp_path)

def get_audio_length(file_bytes):
    command = [
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', 'pipe:0'
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, _ = process.communicate(input=file_bytes)
    duration_seconds = float(stdout.strip())
    return timedelta(seconds=duration_seconds)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python identify.py <audio_file_path> <num_silences> <chapters_file_path>")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    num_silences = int(sys.argv[2])
    chapters_file_path = sys.argv[3]

    largest_silences = find_largest_silences(audio_file_path, num_silences)

    # Create the "clips" folder if it doesn't exist
    clips_folder = "clips"
    os.makedirs(clips_folder, exist_ok=True)
    
    timestamps = []
    with open(chapters_file_path, "r", encoding="utf-8") as file:
        chapters_text = file.read()
        for i, (end) in enumerate(largest_silences, 1):
            output_file = os.path.join(clips_folder, f"clip_{i}.mp3")
            generate_clip(audio_file_path, end, output_file)
            contains_chapter, chapter = query_gemini(output_file, chapters_text)
            if contains_chapter:
                print(f"Chapter found: {chapter} ({end})")
                timestamps.append((chapter, end))
    
    # Write the chapters to a file
    construct_metadata(timestamps, 'output.txt', get_audio_length(audio_file_path))
    

