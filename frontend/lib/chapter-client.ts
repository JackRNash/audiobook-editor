export interface Chapter {
  id: string
  time: number
  title: string
}

export interface ChapterResponse {
  chapters: Chapter[]
  title: string
  author: string
  thumbnail?: string
}

class ChapterClient {
  async loadChapters(audioFile: File): Promise<ChapterResponse> {
    const formData = new FormData();
    formData.append('audiobook', audioFile);

    const response = await fetch('http://127.0.0.1:8089/detectChapters', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to load chapters');
    }

    const data = await response.json();
    return {
      chapters: data.chapters,
      title: data.title,
      author: data.author,
      thumbnail: data.thumbnail,
    };
  }

  async generateChapters(text: string, audioFile: File, numSilences: number, sampleRate: number): Promise<Chapter[]> {
    const formData = new FormData();
    formData.append('tableOfContents', JSON.stringify(text.split('\n').filter(line => line.trim())));
    formData.append('audioFile', audioFile);
    formData.append('numSilences', numSilences.toString());
    formData.append('sampleRate', sampleRate.toString());

    // if 0 silences, throw an error
    if (numSilences === 0) {
      throw new Error('Number of silences must be greater than 0');
    }

    try {
      const response = await fetch('http://127.0.0.1:8089/generateChapters', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate chapters');
      }

      const data = await response.json();
      console.log('Server response:', data);

      if (!Array.isArray(data)) {
        throw new Error('Invalid response format: expected array of chapters');
      }

      // Validate each chapter object
      const chapters = data.map((chapter: any) => ({
        id: String(chapter.id),
        time: Number(chapter.time),
        title: String(chapter.title)
      }));

      console.log('Processed chapters:', chapters);
      return chapters;

    } catch (error) {
      console.error('Error in generateChapters:', error);
      throw error;
    }
  }

  async exportChapters(file: File, filename: string, chapters: Chapter[], title: string, author: string, thumbnail?: File): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', filename);
    formData.append('chapters', JSON.stringify(chapters));
    formData.append('title', title);
    formData.append('author', author);
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    const response = await fetch('http://127.0.0.1:8089/exportChapters', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to export chapters');
    }

    return await response.blob();
  }
}

export const chapterClient = new ChapterClient()

