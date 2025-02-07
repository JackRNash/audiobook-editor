export interface Chapter {
  id: string
  time: number
  title: string
}

class ChapterClient {
  // async loadChapters(): Promise<Chapter[]> {
  //   // Simulating an API call with a delay
  //   await new Promise((resolve) => setTimeout(resolve, 500))
  //   return [
  //     { id: "1", time: 0, title: "Introduction" },
  //     { id: "2", time: 5, title: "Chapter 1" },
  //     { id: "3", time: 8, title: "Chapter 2" },
  //     { id: "4", time: 30, title: "Chapter 3" },
  //     { id: "5", time: 40, title: "Conclusion" },
  //   ]
  // }
  async loadChapters(audioFile: File): Promise<Chapter[]> {
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
    return data.chapters;
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

  async exportChapters(chapters: Chapter[]): Promise<string> {
    // Simulating an API call with a delay
    await new Promise((resolve) => setTimeout(resolve, 500))
    return "This is a dummy export file for the audiobook chapters."
  }
}

export const chapterClient = new ChapterClient()

