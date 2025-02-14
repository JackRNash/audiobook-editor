from io import BytesIO
import json
import logging
import os
import re
import sys
import subprocess
import tempfile
from typing import List, Tuple
import numpy as np
from datetime import timedelta
from tqdm import tqdm
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

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

    # First, check if there's any video/image stream
        probe_command = [
            'ffprobe', '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_type',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audio_temp_path
        ]
        
        probe_process = subprocess.Popen(probe_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        probe_stdout, _ = probe_process.communicate()
        
        # If there's no video stream, return None
        if not probe_stdout.strip():
            return None

    # If we found a video stream, try to extract it
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

def detect_silences(audio_path: str, noise_threshold_db: float = -60, min_silence_duration: float = 1) -> List[Tuple[float, float]]:
    """
    Detect silent periods from a byte stream using ffmpeg's silencedetect filter.
    """
    
    # Construct the ffmpeg command
    cmd = [
        'ffmpeg',
        '-i', audio_path,
        '-acodec', 'pcm_s16le',  # Convert to raw PCM first
        '-af', f'silencedetect=noise={noise_threshold_db}dB:d={min_silence_duration}',
        '-f', 'null',
        '-'
    ]
    
    # Run ffmpeg command and capture stderr output
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False
        )
        _, stderr = process.communicate()
    except subprocess.CalledProcessError as e:
        logger.error(f"Error running ffmpeg: {e.stderr}")
        raise
    
    # Parse the output to find silence start and end times
    silence_periods = []
    
    stderr_str = stderr.decode("utf-8", errors="ignore")
        
    # Regular expressions to match silence_start and silence_end lines
    start_pattern = r'silence_start: (\d+\.?\d*)'
    end_pattern = r'silence_end: (\d+\.?\d*)'
    
    # Find all silence starts and ends
    starts = [float(x) for x in re.findall(start_pattern, stderr_str)]
    ends = [float(x) for x in re.findall(end_pattern, stderr_str)]
    
    # Pair up the starts and ends
    silence_periods = list(zip(starts, ends))

    logger.info(f"Found {len(silence_periods)} silence periods")
    logger.info(f"First 10: {silence_periods[:10]}")
    
    return silence_periods

def find_silences(audio_data, silence_threshold, min_silence_len):
    # Ensure the buffer size is a multiple of 2 (16 bits = 2 bytes)
    buffer_length = len(audio_data)
    if buffer_length % 2 != 0:
        logger.info(f"Warning: Truncating buffer from {buffer_length} to {buffer_length - 1} bytes")
        audio_data = audio_data[:-1]
    
    # Convert bytes to numpy array
    try:
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        logger.info(f"Converted {len(audio_data)} bytes to {len(audio_array)} samples")
    except ValueError as e:
        logger.error(f"Error converting audio data: {e}")
        logger.error(f"Audio data length: {len(audio_data)} bytes")
        raise

    # Normalize audio data to float between -1 and 1
    audio_data = audio_array.astype(np.float32) / 32768.0
    
    # Process in chunks to improve performance
    chunk_size = 1024
    silence_samples = []
    current_silence_start = None
    min_chunk_silence_len = int(min_silence_len / chunk_size)
    print (f"Minimum chunk silence length: {min_chunk_silence_len} chunks")
    
    for i in tqdm(range(0, len(audio_data), chunk_size), desc="Finding silences"):
        chunk = audio_data[i:i + chunk_size]

        avg_amplitude = np.mean(np.abs(chunk))
        
        if avg_amplitude < silence_threshold:
            if current_silence_start is None:
                current_silence_start = i
        else:
            if current_silence_start is not None:
                silence_duration = i - current_silence_start
                if ((i - current_silence_start) // chunk_size) >= min_chunk_silence_len:
                    logger.info(f"Silence from {current_silence_start} to {i}")
                    silence_samples.append((current_silence_start, i))
                current_silence_start = None
    
    # Handle silence at the end of the file
    if current_silence_start is not None:
        silence_duration = len(audio_data) - current_silence_start
        if silence_duration >= min_silence_len:
            logger.info('Silence at end of file')
            silence_samples.append((current_silence_start, len(audio_data)))
    
    logger.info(f"Found {len(silence_samples)} silence periods")
    return silence_samples


def get_sample_rate(audio_data):
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
    temp_path = temp_file.name
    try:
        temp_file.write(audio_data)
        temp_file.flush()
        temp_file.close()  # Explicitly close the file handle

        command = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'a:0',
            '-show_entries', 'stream=sample_rate',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            temp_path
        ]
        
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            logger.warning(f"Warning: Could not get sample rate: {stderr.decode('utf-8')}")
            return 16000  # fallback to default
        
        sample_rate = int(stdout.strip())
        logger.info(f"Sample rate: {sample_rate}")
        return sample_rate
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception as e:
            logger.warning(f"Warning: Could not remove temporary file {temp_path}: {e}")

def find_largest_silences(audio_data, num_silences, num_existing, sample_rate, audiobook_path):
    logger.info(f"Using sample rate: {sample_rate} Hz")
    
    # Adjust threshold - now working with normalized values between 0 and 1
    silence_threshold = .05  # 1% of maximum amplitude
    min_silence_len = int(sample_rate * 0.5)  # 0.5 seconds of silence
    
    logger.info(f"Silence threshold: {silence_threshold}")
    logger.info(f"Minimum silence length: {min_silence_len} samples")
    
    silences = detect_silences(audiobook_path)
    
    # Calculate silence durations and sort by duration
    silence_durations = [(start, end, end - start) for start, end in silences]
    sorted_silences = sorted(silence_durations, key=lambda x: x[2], reverse=True)
    
    # Skip num_existing and take the next num_silences
    selected_silences = sorted_silences[num_existing:num_existing + num_silences]
    
    # Sort by position in audio and convert to timedelta strings
    largest_silences = sorted(selected_silences, key=lambda x: x[0])
    largest_silences = [(str(timedelta(seconds=end))) for start, end, _ in largest_silences]
    
    return largest_silences

def generate_clip(input_file, timestamp, output_file):
    command = [
        'ffmpeg', '-y', '-i', input_file, '-ss', timestamp, '-t', '10', output_file
    ]
    try:
        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Error generating clip: {e.stderr}")
        raise

def parse_timestamp(timestamp):
    # hours, minutes, seconds = map(float, timestamp.split(':'))
    # return timedelta(hours=hours, minutes=minutes, seconds=seconds)
    seconds = float(timestamp)
    return timedelta(seconds=seconds)

def parse_timestamp_from_hhmmssxx(timestamp):
    """Parse timestamp in format HH:MM:SS.xxxxx"""
    try:
        # Split into parts
        time_parts = timestamp.split(':')
        if len(time_parts) == 3:
            hours = float(time_parts[0])
            minutes = float(time_parts[1])
            seconds = float(time_parts[2])
            total_seconds = hours * 3600 + minutes * 60 + seconds
            return timedelta(seconds=total_seconds)
    except Exception as e:
        logger.info(f"Error parsing timestamp {timestamp}: {e}")
        # Try parsing as raw seconds as fallback
        try:
            return timedelta(seconds=float(timestamp))
        except:
            logger.info(f"Could not parse timestamp as seconds either")
            return timedelta(seconds=0)

def construct_metadata(chapters, title, author, total_length_placeholder):
    metadata = ";FFMETADATA1\n"
    metadata += f"title={title}\n"
    metadata += f"artist={author}\n\n"

    for i, chapter in enumerate(chapters):
        start = 0 if i == 0 else int(parse_timestamp(chapter['time']).total_seconds() * 1000)
        end = int(parse_timestamp(chapters[i+1]['time']).total_seconds() * 1000) if i < len(chapters) - 1 else int(total_length_placeholder.total_seconds() * 1000)
        metadata += f"[CHAPTER]\nTIMEBASE=1/1000\nSTART={start}\nEND={end}\ntitle={chapter['title']}\n\n"

    return metadata

def merge_metadata_with_audio(input_audio_stream, metadata_str, suffix, thumbnail_bytes=None):
    # Thumbnail present?
    if thumbnail_bytes:
        logger.info('Thumbnail detected')
    else:
        logger.info('No thumbnail detected')
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as audio_temp, \
         tempfile.NamedTemporaryFile(delete=False) as metadata_temp, \
         tempfile.NamedTemporaryFile(delete=False, suffix='.m4b') as output_temp:
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

        if suffix in ['.aac', '.m4a', '.m4b']:
            logger.info('Using copy codec for AAC input')
            command.extend(['-c:a', 'copy'])
        else:
            logger.info('Transcoding to AAC (this may take a while, ~1 min / hour of audio)')
            command.extend([
                '-c:a', 'aac',
                '-b:a', '192k',
            ])

        # Image codec settings
        if thumbnail_bytes:
            command.extend(['-c:v', 'mjpeg'])

        # Output options
        command.extend([
            # '-f', 'ipod',  # Force M4B container
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

def get_audio_length(file_bytes, suffix):
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_path = temp_file.name
        temp_file.write(file_bytes)
        temp_file.flush()

    try:
        command = [
            'ffprobe', 
            '-v', 'error', 
            '-i', temp_path,
            '-show_entries', 'format=duration', 
            '-of', 'default=noprint_wrappers=1:nokey=1', 
        ]
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, _ = process.communicate(input=file_bytes)
        duration_seconds = float(stdout.strip())
        return timedelta(seconds=duration_seconds)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        logger.info("Usage: python identify.py <audio_file_path> <num_silences> <chapters_file_path>")
        sys.exit(1)
    
    audio_file_path = sys.argv[1]
    num_silences = int(sys.argv[2])
    chapters_file_path = sys.argv[3]

    largest_silences = find_largest_silences(audio_file_path, num_silences)

    # Create the "clips" folder if it doesn't exist
    clips_folder = "clips"
    os.makedirs(clips_folder, exist_ok=True)
    
    timestamps = []
    # with open(chapters_file_path, "r", encoding="utf-8") as file:
    #     chapters_text = file.read()
    #     for i, (end) in enumerate(largest_silences, 1):
    #         output_file = os.path.join(clips_folder, f"clip_{i}.mp3")
    #         generate_clip(audio_file_path, end, output_file)
    #         contains_chapter, chapter = query_gemini(output_file, chapters_text)
    #         if contains_chapter:
    #             logger.info(f"Chapter found: {chapter} ({end})")
    #             timestamps.append((chapter, end))
    
    # Write the chapters to a file
    construct_metadata(timestamps, 'output.txt', get_audio_length(audio_file_path))
    

