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
  async generateChapters(): Promise<Chapter[]> {
    // Simulating an API call with a delay
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return [
      { id: "1", time: 0, title: "Generated Intro" },
      { id: "2", time: 10, title: "Generated Chapter 1" },
      { id: "3", time: 20, title: "Generated Chapter 2" },
      { id: "4", time: 30, title: "Generated Chapter 3" },
      { id: "5", time: 40, title: "Generated Conclusion" },
    ]
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
      throw new Error('Failed to export chapters');
    }

    return await response.blob();
  }
}

export const chapterClient = new ChapterClient()

