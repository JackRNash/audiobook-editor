import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface TextInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string, numSilences: number) => void;
}

export default function TextInputModal({
  isOpen,
  onClose,
  onSubmit,
}: TextInputModalProps) {
  const [text, setText] = useState("");
  const [numSilences, setNumSilences] = useState(1);

  useEffect(() => {
    // Count non-empty lines in text
    const lineCount = text.split('\n').filter(line => line.trim()).length;
    // Add buffer for potential missed silences
    setNumSilences(lineCount + 8);
  }, [text]);

  const handleSubmit = () => {
    onSubmit(text, numSilences);
    setText("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Enter Chapter Names</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Paste your chapter list of chapters / table of contents. AI will scan for them in the audiobook. Chapters should be separated by new lines"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[300px] p-4 bg-gray-700 text-white placeholder:text-gray-400 border-gray-600 focus:border-purple-500"
          />
          <div className="flex items-center space-x-4">
            <Label htmlFor="silences" className="text-white whitespace-nowrap">
              Number of silences to scan:
            </Label>
            <Input
              id="silences"
              type="number"
              min={1}
              value={numSilences}
              onChange={(e) => setNumSilences(parseInt(e.target.value))}
              className="w-24 bg-gray-700 text-white border-gray-600 focus:border-purple-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-white bg-gray-600 hover:bg-gray-700 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
