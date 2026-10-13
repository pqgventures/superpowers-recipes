---
name: testimonial-ad-video
description: Turn an app's real 5-star App Store reviews into a narrated, captioned 9:16 testimonial video ad with Superpowers. Use when the user wants a UGC-style or social-proof ad, a Reels/TikTok/Shorts video from reviews, or ad creative for an app.
---

# Testimonial ad video from App Store reviews

A Superpowers recipe. Give it an app; it reads the latest App Store reviews, picks three 5-star quotes word for word, makes a matching background for each, and renders a 25–35 second vertical (1080×1920) video with a voiceover, a hook and a closing line. Every scene says "Real App Store reviews · AI visuals and voice". Typical cost: about $0.09 per video, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **app** (required): the App Store name or numeric id. Use the id when the name is ambiguous.
- **country** (optional, default us): the two-letter store whose reviews to use.

Use it for the user's own app, or one they have the right to advertise. Mention the cost before the first run.

## Fastest way: run the script

    curl -s "https://superpowers.tools/recipes/testimonial-ad-video/run.mjs" -o sp-testimonial.mjs
    node sp-testimonial.mjs --app "Calm" --country us

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd and each step's output. The video link is in the first item. Use this path whenever Node or Bun is available: it makes exactly the calls needed and reports the real total charge.

## Doing it step by step

Only when you cannot run Node or Bun. Make exactly one image per quote and reuse it if a later step fails; report the total charge as the sum of charge_usd from every call, retries included. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. Reviews: `appstore.reviews` with {"query": "<app>"} or {"app_id": "<id>"}, plus "country" and "limit": 50. Keep 5-star reviews of 60–600 characters, and skip any about death, illness, children or anything private.
2. Pick quotes: an LLM (for example `openrouter.anthropic-claude-sonnet-5`, {"prompt", "max_tokens": 1500}) chooses three reviews and copies an 8–22 word excerpt from each. Check that every excerpt appears exactly in its review; if not, use the review's first 20 words instead. Never edit a quote.
3. Backgrounds: `openai.gpt-image-1-mini` with {"prompt": "<scene>, no text, no logos", "size": "portrait"}, once per quote.
4. Video: `videokit.vertical-video` with {"disclosure": "Real App Store reviews · AI visuals and voice", "scenes": [hook scene, three quote scenes with "badge": "five_stars" and "caption": "App Store review", closing scene]}. Each scene has image_url and text; narration defaults to the text.
5. Publish: POST https://superpowers.tools/v1/shares {"title": "<App>: testimonial ad", "recipe": "testimonial-ad-video", "items": [{"label": "Video", "url": "<video_url>"}, {"label": "Quotes used", "text": "<quotes with dates>"}]}. Keep `"recipe": "testimonial-ad-video"` so the link counts for this recipe.

## After the run

Give the user the share_url and the video link. Remind them the quotes are real reviews shown without names, that the visuals and voice are AI-generated (the label stays on screen), and that store rules on using reviews in ads vary by platform. Offer a second cut with different quotes, or a non-US store.
