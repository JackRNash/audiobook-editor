import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import content

class AI:
    def __init__(self, api_key):
        self.api_key = api_key
        genai.configure(api_key=api_key)


    def has_api_key(self):
        return self.api_key is not None
    
    def parse_gemini_response(response):
        response_json = json.loads(response)
        contains_chapter = response_json.get('containsChapter')
        chapter = response_json.get('chapter')
        return contains_chapter, chapter

    def query_gemini(clip_path, chapters):
        clip = genai.upload_file(path=clip_path)
        # clip = upload_to_gemini(path='clip_1.mp3')
        # response = client.models.generate_content(
        #     model="gemini-2.0-flash",
        #     contents=["Prologue", clip],
        # )

        # Create the model
        generation_config = {
        "temperature": 1,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 8192,
        "response_schema": content.Schema(
            type = content.Type.OBJECT,
            enum = [],
            required = ["containsChapter"],
            properties = {
            "containsChapter": content.Schema(
                type = content.Type.BOOLEAN,
            ),
            "chapter": content.Schema(
                type = content.Type.STRING,
            ),
            },
        ),
        "response_mime_type": "application/json",
        }

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config=generation_config,
            system_instruction="I will give you an audio snippet and a list of possible chapter titles. You respond in json tell me if one of those chapters is present in the audio clip and if so, which one",
            )
        
        response = model.generate_content([chapters, clip])

        return parse_gemini_response(response.text)
