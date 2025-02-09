"use client";

import { useState, useRef, type ChangeEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AudioPlayer from "./AudioPlayer";
import ChapterMarks from "./ChapterMarks";
import { Upload, Wand2, Download } from "lucide-react";
import { chapterClient, type Chapter } from "@/lib/chapter-client";
import AudiobookMetadata from "./AudiobookMetadata";
import TextInputModal from "./TextInputModal";

export default function AudioChapterPlayer() {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [audiobookTitle, setAudiobookTitle] = useState("Untitled Audiobook");
  const [audiobookAuthor, setAudiobookAuthor] = useState("Unknown Author");
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);

  const getSampleRate = async (audioRef: RefObject<HTMLAudioElement>): Promise<number> => {
    // Create a temporary audio context to get the real sample rate
    if (!audioRef.current) {
      throw new Error('Audio element is not available');
    }
    // Create audio context after audio is loaded
    const audioContext = new (window.AudioContext)();
    const source = audioContext.createMediaElementSource(audioRef.current);
    source.connect(audioContext.destination); // Connect to speakers
    const sampleRate = audioContext.sampleRate;
    console.log(`Duration: ${audioRef.current.duration}s`);
    console.log(`Sample Rate: ${sampleRate}Hz`);
    return sampleRate;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setAudioSrc(objectUrl);

      setIsLoading(true);
      try {
        const newChapters = await chapterClient.loadChapters(file);
        setChapters(newChapters.chapters);
        setCurrentChapter(newChapters.chapters[0]);
        setAudiobookTitle(newChapters.title);
        setAudiobookAuthor(newChapters.author);
        if (newChapters.thumbnail) {
          const thumbnailUrl = `data:image/jpeg;base64,${newChapters.thumbnail}`;
          setCoverUrl(thumbnailUrl);
        } else {
          setCoverUrl(null); // Reset the cover image
        }
      } catch (error) {
        console.error("Error loading chapters:", error);
        // Handle error (e.g., show an error message to the user)
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (audioSrc) {
      setIsTextModalOpen(true);
    }
  };

  const handleTextSubmit = async (text: string) => {
    if (audioSrc) {
      setIsLoading(true);
      try {
        const file = await fetch(audioSrc).then((r) => r.blob());
        const audioFile = new File([file], "audiobook.mp3", {
          type: "audio/mpeg",
        });
        const numChapters = text
          .split("\n")
          .filter((line) => line.trim()).length;
        console.log("Chapters: ", numChapters);
        const sampleRate = await getSampleRate(audioRef);

        const newChapters = await chapterClient.generateChapters(
          text,
          audioFile,
          numChapters,
          sampleRate
        );
        setChapters(newChapters);
        setCurrentChapter(newChapters[0]);
      } catch (error) {
        console.error("Error generating chapters:", error);
        setChapters([]); // Set empty array as fallback
        setCurrentChapter(null);
        // Handle error (e.g., show an error message to the user)
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEditChapter = (id: string, newTitle: string) => {
    setChapters(
      chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, title: newTitle } : chapter
      )
    );
    if (currentChapter?.id === id) {
      setCurrentChapter({ ...currentChapter, title: newTitle });
    }
  };

  const handleEditChapterTime = (id: string, newTime: number) => {
    setChapters(
      chapters.map((chapter) =>
        chapter.id === id ? { ...chapter, time: newTime } : chapter
      )
    );
  };

  const handleDeleteChapter = (id: string) => {
    const newChapters = chapters.filter((chapter) => chapter.id !== id);
    setChapters(newChapters);
    if (currentChapter?.id === id) {
      setCurrentChapter(newChapters[0] || null);
    }
  };

  const updateCurrentChapter = (time: number) => {
    setCurrentAudioTime(time);
    const newCurrentChapter = chapters.reduce((prev, current) => {
      if (
        time >= current.time &&
        (prev.time <= current.time || time < prev.time)
      ) {
        return current;
      }
      return prev;
    });
    setCurrentChapter(newCurrentChapter);
  };

  const handleAddChapter = () => {
    const currentTime = audioRef.current?.currentTime || 0;
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: "New Chapter",
      time: currentTime,
    };

    const updatedChapters = [...chapters];
    const insertIndex = updatedChapters.findIndex(
      (chapter) => chapter.time > currentTime
    );

    if (insertIndex === -1) {
      updatedChapters.push(newChapter);
    } else {
      updatedChapters.splice(insertIndex, 0, newChapter);
    }

    setChapters(updatedChapters);
    setCurrentChapter(newChapter);
  };

  const handleExport = async () => {
    if (!fileInputRef.current?.files?.[0]) {
      console.error("No file selected for export");
      return;
    }

    setIsLoading(true);
    try {
      const file = fileInputRef.current.files[0];
      let thumbnailFile: File | undefined;
      if (coverUrl) {
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        thumbnailFile = new File([blob], "cover.jpg", { type: blob.type });
      }

      const blob = await chapterClient.exportChapters(
        file,
        file.name,
        chapters,
        audiobookTitle,
        audiobookAuthor,
        thumbnailFile
      );

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.split(".")[0]}.m4b`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting chapters:", error);
      // Handle error (e.g., show an error message to the user)
    } finally {
      setIsLoading(false);
    }
  };

  const handleJumpToChapter = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      updateCurrentChapter(time);
    }
  };

  const handleUpdateCover = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setCoverUrl(objectUrl);
  };

  const handleUpdateTitle = (newTitle: string) => {
    setAudiobookTitle(newTitle);
  };

  const handleUpdateAuthor = (newAuthor: string) => {
    setAudiobookAuthor(newAuthor);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    //React was added here
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleUpdateCover(blob);
        }
        break;
      }
    }
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      <div className="flex items-center space-x-4">
        <Input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          ref={fileInputRef}
          className="hidden"
          id="audio-file"
        />
        <label
          htmlFor="audio-file"
          className="flex-1 cursor-pointer bg-gray-700 hover:bg-gray-600 text-white rounded-lg p-4 transition duration-300 ease-in-out flex items-center justify-center space-x-2"
        >
          <Upload className="w-5 h-5" />
          <span>{audioSrc ? "Change Audiobook" : "Upload Audiobook"}</span>
        </label>
        <Button
          onClick={handleGenerate}
          className="bg-purple-600 hover:bg-purple-700"
          disabled={isLoading || !audioSrc}
        >
          <Wand2 className="w-5 h-5 mr-2" />
          Generate Chapters
        </Button>
      </div>
      {audioSrc && (
        <div className="bg-gray-700 rounded-lg p-6 space-y-6 animate-fadeIn">
          <AudiobookMetadata
            coverUrl={coverUrl}
            title={audiobookTitle}
            author={audiobookAuthor}
            onUpdateCover={handleUpdateCover}
            onUpdateTitle={handleUpdateTitle}
            onUpdateAuthor={handleUpdateAuthor}
          />
          <AudioPlayer
            src={audioSrc}
            chapters={chapters}
            currentChapter={currentChapter}
            onTimeUpdate={updateCurrentChapter}
            onEditChapter={handleEditChapter}
            onDeleteChapter={handleDeleteChapter}
            audioRef={audioRef}
            onAddChapter={handleAddChapter}
          />
          <ChapterMarks
            chapters={chapters}
            currentChapter={currentChapter}
            onEditChapter={handleEditChapter}
            onEditChapterTime={handleEditChapterTime}
            onDeleteChapter={handleDeleteChapter}
            currentAudioTime={currentAudioTime}
            onJumpToChapter={handleJumpToChapter}
          />
          <Button
            onClick={handleExport}
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isLoading || chapters.length === 0}
          >
            <Download className="w-5 h-5 mr-2" />
            Export Chapters
          </Button>
        </div>
      )}
      <TextInputModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        onSubmit={handleTextSubmit}
      />
    </div>
  );
}
