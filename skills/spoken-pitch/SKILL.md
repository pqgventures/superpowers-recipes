---
name: spoken-pitch
description: Write a 30-second pitch for a product and record it as an MP3 voice-over with Superpowers, delivered as a link the user can play or forward. Use when the user wants a voice-over, a spoken pitch, an audio ad or narration for a short video.
---

# 30-second spoken pitch

A Superpowers recipe: writes a ~70-word pitch in the language the user wants and records it with a neutral voice. Typical cost: about $0.01 per run.

Needs a Superpowers API key. If you don't have one yet: https://superpowers.tools/skill.md?src=github

## Inputs

- **product** (required): what is being pitched.
- **language** (optional, default "Portuguese (Brazil)").

## Run the script

    curl -s "https://superpowers.tools/recipes/spoken-pitch/run.mjs" -o sp-spoken-pitch.mjs
    node sp-spoken-pitch.mjs --product "bakery delivery in Campinas"

Prints JSON with share_url (a page with the audio player and the script), charge_usd and each step's output. The MP3 URL is in steps.voice.normalized.audio_url if the user wants the file.

## Step by step

1. POST https://superpowers.tools/v1/run with tool openai.gpt-5.4-mini and {"prompt": "Write a warm, confident 30-second spoken pitch (about 70 words) for <product> in <language>. Plain text only, no stage directions, no emojis.", "max_tokens": 220}.
2. POST https://superpowers.tools/v1/run with tool openai.tts-1 and {"text": <the script>, "voice": "alloy"}. For more expressive delivery use openai.gpt-4o-mini-tts with an "instructions" field (slower).
3. POST https://superpowers.tools/v1/shares {"title": "<Product>: spoken pitch", "recipe": "spoken-pitch", "items": [{"label": "Voice-over", "url": <audio_url>}, {"label": "Script", "text": <script>}]}.

Show the user the script before recording if they care about wording; re-record after edits.
