"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Pencil } from "lucide-react";

interface AudiobookMetadataProps {
  coverUrl: string | null;
  title: string;
  author: string;
  onUpdateCover: (file: File) => void;
  onUpdateTitle: (title: string) => void;
  onUpdateAuthor: (author: string) => void;
}

export default function AudiobookMetadata({
  coverUrl,
  title,
  author,
  onUpdateCover,
  onUpdateTitle,
  onUpdateAuthor,
}: AudiobookMetadataProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingAuthor, setIsEditingAuthor] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedAuthor, setEditedAuthor] = useState(author);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedTitle(title);
    setEditedAuthor(author);
  }, [title, author]);

  const handleCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpdateCover(file);
    }
  };

  const handleTitleEdit = () => {
    onUpdateTitle(editedTitle);
    setIsEditingTitle(false);
  };

  const handleAuthorEdit = () => {
    onUpdateAuthor(editedAuthor);
    setIsEditingAuthor(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6 flex items-start space-x-6">
      <div className="relative w-40 h-40 bg-gray-700 rounded-lg overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl || "/placeholder.svg"}
            alt="Audiobook cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Upload className="w-12 h-12 text-gray-500" />
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleCoverUpload}
          accept="image/*"
          className="hidden"
        />
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-2 right-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          {coverUrl ? "Change" : "Upload"}
        </Button>
      </div>
      <div className="flex-grow">
        <div className="mb-4">
          {isEditingTitle ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleEdit}
              onKeyDown={(e) => e.key === "Enter" && handleTitleEdit()}
              className="text-2xl font-bold bg-gray-700 text-white"
              autoFocus
            />
          ) : (
            <h2 className="text-2xl font-bold flex items-center">
              {title}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingTitle(true)}
                className="ml-2"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </h2>
          )}
        </div>
        <div>
          {isEditingAuthor ? (
            <Input
              value={editedAuthor}
              onChange={(e) => setEditedAuthor(e.target.value)}
              onBlur={handleAuthorEdit}
              onKeyDown={(e) => e.key === "Enter" && handleAuthorEdit()}
              className="text-lg bg-gray-700 text-white"
              autoFocus
            />
          ) : (
            <p className="text-lg text-gray-300 flex items-center">
              {author}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingAuthor(true)}
                className="ml-2"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
