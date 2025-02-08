"use client";

import { useState, useRef, useEffect, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Pencil,
  Trash2,
  Check,
  X,
  Rewind,
  FastForward,
} from "lucide-react";
import type { Chapter } from "@/lib/chapter-client";
import { formatTime } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  chapters: Chapter[];
  currentChapter: Chapter | null;
  onTimeUpdate: (time: number) => void;
  onEditChapter: (id: string, newTitle: string) => void;
  onDeleteChapter: (id: string) => void;
  audioRef: RefObject<HTMLAudioElement>;
}

export default function AudioPlayer({
  src,
  chapters,
  currentChapter,
  onTimeUpdate,
  onEditChapter,
  onDeleteChapter,
  audioRef,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let rafId: number;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate(audio.currentTime);
      rafId = requestAnimationFrame(updateTime);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      updateTime();
    };

    const handlePause = () => {
      setIsPlaying(false);
      cancelAnimationFrame(rafId);
    };

    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      cancelAnimationFrame(rafId);
    };
  }, [audioRef, onTimeUpdate]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipToChapter = (direction: "forward" | "backward") => {
    const audio = audioRef.current;
    if (!audio || chapters.length === 0) return;

    const currentChapterIndex = chapters.findIndex(
      (chapter) => chapter.id === currentChapter?.id
    );

    let newIndex: number;
    if (direction === "forward") {
      newIndex =
        currentChapterIndex === -1
          ? 0
          : Math.min(currentChapterIndex + 1, chapters.length - 1);
    } else {
      newIndex =
        currentChapterIndex === -1
          ? chapters.length - 1
          : Math.max(currentChapterIndex - 1, 0);
    }

    const newTime = chapters[newIndex].time;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleEditClick = () => {
    if (currentChapter) {
      setEditTitle(currentChapter.title);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (currentChapter) {
      onEditChapter(currentChapter.id, editTitle);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const skipTime = (seconds: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(
        0,
        Math.min(audio.currentTime + seconds, audio.duration)
      );
      setCurrentTime(audio.currentTime);
    }
  };

  const jumpToChapter = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} src={src} />
      {currentChapter && (
        <div className="flex items-center justify-between text-lg font-semibold text-white bg-gray-600 rounded-lg p-2 max-w-[600px] mx-auto">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="mr-2 bg-gray-700 text-white"
              onFocus={(e) => e.target.select()}
            />
          ) : (
            <span>{currentChapter.title}</span>
          )}
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveEdit}
                  className="hover:bg-gray-500"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="hover:bg-gray-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleEditClick}
                  className="hover:bg-gray-500"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteChapter(currentChapter.id)}
                  className="hover:bg-gray-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-center space-x-4">
        <Button
          size="icon"
          variant="outline"
          onClick={() => skipToChapter("backward")}
          disabled={chapters.length === 0}
          className="bg-gray-600 hover:bg-gray-500 text-white"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => skipTime(-5)}
          className="bg-gray-600 hover:bg-gray-500 text-white"
        >
          <Rewind className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          onClick={togglePlayPause}
          className={`${
            isPlaying
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          } text-white transition-colors duration-300`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => skipTime(5)}
          className="bg-gray-600 hover:bg-gray-500 text-white"
        >
          <FastForward className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => skipToChapter("forward")}
          disabled={chapters.length === 0}
          className="bg-gray-600 hover:bg-gray-500 text-white"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative">
        <Slider
          value={[currentTime]}
          max={duration}
          step={0.1}
          onValueChange={(value) => handleSliderChange(value)}
          className="cursor-pointer"
        />
        {chapters.map((chapter) => (
          <div
            key={chapter.id}
            className="absolute w-0.5 h-4 bg-blue-500 cursor-pointer hover:bg-blue-400 transition-colors"
            style={{
              left: `${(chapter.time / duration) * 100}%`,
              top: "-8px",
            }}
            onClick={() => jumpToChapter(chapter.time)}
            title={`Jump to ${formatTime(chapter.time)}`}
          />
        ))}
      </div>
      <div className="text-center text-gray-300">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
}
