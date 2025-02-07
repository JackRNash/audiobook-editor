"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import AudioPlayer from "./AudioPlayer"
import ChapterMarks from "./ChapterMarks"
import { Upload, Wand2, Download } from "lucide-react"
import { chapterClient, type Chapter } from "@/lib/chapter-client"
import AudiobookMetadata from "./AudiobookMetadata"

export default function AudioChapterPlayer() {
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentAudioTime, setCurrentAudioTime] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [audiobookTitle, setAudiobookTitle] = useState("Untitled Audiobook")
  const [audiobookAuthor, setAudiobookAuthor] = useState("Unknown Author")

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const objectUrl = URL.createObjectURL(file)
      setAudioSrc(objectUrl)

      setIsLoading(true)
      try {
        const newChapters = await chapterClient.loadChapters(file)
        setChapters(newChapters)
        setCurrentChapter(newChapters[0])
      } catch (error) {
        console.error("Error loading chapters:", error)
        // Handle error (e.g., show an error message to the user)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleGenerate = async () => {
    if (audioSrc) {
      setIsLoading(true)
      try {
        const newChapters = await chapterClient.generateChapters()
        setChapters(newChapters)
        setCurrentChapter(newChapters[0])
      } catch (error) {
        console.error("Error generating chapters:", error)
        // Handle error (e.g., show an error message to the user)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleEditChapter = (id: string, newTitle: string) => {
    setChapters(chapters.map((chapter) => (chapter.id === id ? { ...chapter, title: newTitle } : chapter)))
    if (currentChapter?.id === id) {
      setCurrentChapter({ ...currentChapter, title: newTitle })
    }
  }

  const handleEditChapterTime = (id: string, newTime: number) => {
    setChapters(chapters.map((chapter) => (chapter.id === id ? { ...chapter, time: newTime } : chapter)))
  }

  const handleDeleteChapter = (id: string) => {
    const newChapters = chapters.filter((chapter) => chapter.id !== id)
    setChapters(newChapters)
    if (currentChapter?.id === id) {
      setCurrentChapter(newChapters[0] || null)
    }
  }

  const updateCurrentChapter = (time: number) => {
    setCurrentAudioTime(time)
    const newCurrentChapter = chapters.reduce((prev, current) => {
      if (time >= current.time && (prev.time <= current.time || time < prev.time)) {
        return current
      }
      return prev
    })
    setCurrentChapter(newCurrentChapter)
  }

  const handleExport = async () => {
    setIsLoading(true)
    try {
      const content = await chapterClient.exportChapters(chapters)
      const blob = new Blob([content], { type: "text/plain" })
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = "audiobook_chapters.txt"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting chapters:", error)
      // Handle error (e.g., show an error message to the user)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJumpToChapter = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      updateCurrentChapter(time)
    }
  }

  const handleUpdateCover = (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setCoverUrl(objectUrl)
  }

  const handleUpdateTitle = (newTitle: string) => {
    setAudiobookTitle(newTitle)
  }

  const handleUpdateAuthor = (newAuthor: string) => {
    setAudiobookAuthor(newAuthor)
  }

  return (
    <div className="space-y-6">
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
          Generate
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
    </div>
  )
}

