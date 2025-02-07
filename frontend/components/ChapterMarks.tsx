"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Trash2, Clock } from "lucide-react"
import type { Chapter } from "@/lib/chapter-client"
import { Input } from "@/components/ui/input"

interface ChapterMarksProps {
  chapters: Chapter[]
  currentChapter: Chapter | null
  onEditChapter: (id: string, newTitle: string) => void
  onEditChapterTime: (id: string, newTime: number) => void
  onDeleteChapter: (id: string) => void
  currentAudioTime: number
  onJumpToChapter: (time: number) => void
}

export default function ChapterMarks({
  chapters,
  currentChapter,
  onEditChapter,
  onEditChapterTime,
  onDeleteChapter,
  currentAudioTime,
  onJumpToChapter,
}: ChapterMarksProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editType, setEditType] = useState<"title" | "time">("title")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const handleEditClick = (chapter: Chapter, type: "title" | "time") => {
    setEditingId(chapter.id)
    setEditTitle(chapter.title)
    setEditTime(formatTime(chapter.time))
    setEditType(type)
  }

  const handleSaveEdit = () => {
    if (editingId) {
      if (editType === "title") {
        onEditChapter(editingId, editTitle)
      } else {
        const [minutes, seconds] = editTime.split(":").map(Number)
        const newTime = minutes * 60 + seconds
        onEditChapterTime(editingId, newTime)
      }
      setEditingId(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle("")
    setEditTime("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, type: "title" | "time") => {
    if (e.key === "Enter") {
      handleSaveEdit()
    } else if (e.key === "Escape") {
      handleCancelEdit()
    }
  }

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-200">Chapters</h2>
      <ul className="space-y-2 max-h-60 overflow-y-auto pr-4 custom-scrollbar">
        {chapters.map((chapter) => (
          <li
            key={chapter.id}
            className={`bg-gray-600 rounded-lg p-3 transition duration-300 ease-in-out ${
              currentChapter?.id === chapter.id ? "bg-blue-700" : "hover:bg-gray-500"
            }`}
          >
            <div className="flex items-center w-full">
              <div
                className="flex-grow flex items-center cursor-pointer"
                onClick={(e) => {
                  e.preventDefault()
                  onJumpToChapter(chapter.time)
                }}
              >
                {editingId === chapter.id ? (
                  <>
                    <Input
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "time")}
                      className="w-16 mr-2 bg-gray-700 text-white"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, "title")}
                      className="flex-grow mr-2 bg-gray-700 text-white"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </>
                ) : (
                  <>
                    <span
                      className="w-16 text-gray-300 cursor-pointer hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleEditClick(chapter, "time")
                      }}
                    >
                      {formatTime(chapter.time)}
                    </span>
                    <span
                      className="text-white cursor-pointer hover:underline ml-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleEditClick(chapter, "title")
                      }}
                    >
                      {chapter.title}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {editingId === chapter.id ? (
                  <>
                    <Button size="sm" onClick={handleSaveEdit} variant="ghost" className="hover:bg-gray-500">
                      Save
                    </Button>
                    <Button size="sm" onClick={handleCancelEdit} variant="ghost" className="hover:bg-gray-500">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditChapterTime(chapter.id, currentAudioTime)
                      }}
                      variant="ghost"
                      className="hover:bg-gray-500"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChapter(chapter.id)
                      }}
                      variant="ghost"
                      className="hover:bg-gray-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

