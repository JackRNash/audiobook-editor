# audiobook-editor

The code's a mess. It's mostly AI generated. We're going for function over form here

### Project background
I needed a way to add chapter markings to old audiobook files that did not have them. I stitched together a method that involved multiple scripts and substantial manual effort, but I wanted a nicer UI and unified experience to generate chapters, verify, and export them.

After a couple different attempts on how to generate the chapter timestamps, I landed on the method described below which works fairly well. 

### How to use
0. To build from source: `docker compose up --build` and navigate to 
1. Upload an mp3/m4b file
2. Any existing chapters, title, author, and cover art will be loaded and may be modified
3. Press "Generate chapters"
   - Supply a list of chapters separated by new lines that you expect (e.g. Chapter 1/2/3/..., The Big Race, The Bitter Defeat, The Comeback, etc.)
   - `ffmpeg` is used to scan for the largest silences in the file (default is * + numChapters)
   - A 10 second audio clip after each silence is sent to Gemini (free API) along with the list of chapters. If the clip contains a chapter, it is marked. Otherwise, it's discarded
   - The chapters are populated in the UI and you can edit/remove/add as needed
5. Review the output
6. Export

![unnamed](https://github.com/user-attachments/assets/8f73508a-0688-4ad8-a938-46fff1d2edd5)
![unnamed](https://github.com/user-attachments/assets/f8349dea-47b8-4af1-9776-f8cddb897b11)

TODO
- [ ] Add CI/CD to build image via Github Actions
- [ ] Support for folder of mp3s --> concatenate into one file with chapters
