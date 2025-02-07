import AudioChapterPlayer from "@/components/AudioChapterPlayer"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Audiobook Editor
        </h1>
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <AudioChapterPlayer />
        </div>
      </div>
    </main>
  )
}

