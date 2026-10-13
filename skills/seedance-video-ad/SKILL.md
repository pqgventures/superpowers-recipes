---
name: seedance-video-ad
description: Make a short vertical video ad (5 to 10 seconds, with sound) for a product from a one-line brief, optionally starting from a product photo, with Superpowers. Use when the user wants a video ad, a Reels/TikTok/Shorts clip, product b-roll or an AI-generated commercial without a video editor or a video-AI subscription.
---

# Video ad from a one-line brief

A Superpowers recipe. Give it a product (and a photo if there is one); it writes one shot description and renders a vertical 9:16 clip with sound using Seedance 2.0 by ByteDance. Measured cost on 2026-10-09: about $0.40 for a 5-second draft (480p). Standard (720p) is about $0.86 and premium (720p, the full model) about $1.72 per 5 seconds; 8 and 10 seconds scale with length. A clip takes 2 to 4 minutes. Charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **product** (required): what is being advertised, in a few words.
- **audience** (optional): who it's for.
- **photo_url** (optional): a public https link to a product photo; it becomes the first frame, so the product looks like the real one.
- **seconds** (optional): 5, 8 or 10. Default 5.
- **quality** (optional): draft, standard or premium. Default draft. Start with draft, then make the chosen idea in standard or premium.

Tell the user the cost before the first run. Use photos the user owns or may use.

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/seedance-video-ad/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"product": "cold brew coffee subscription", "audience": "busy professionals"}, "idempotency_key": "seedance-video-ad-20261009-2130"}'

The run takes 2 to 4 minutes and keeps going on the server. Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds: you get {"status": "running"} until it finishes, then the result with share_url and charge_usd. Make the key unique for each new report (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/seedance-video-ad/run. You are charged once however many times you ask. With MCP, call run_recipe with {"recipe": "seedance-video-ad", "inputs": {...}, "idempotency_key": "..."} the same way. Never start a run with a new key while one is running, and never mix it with the step by step path. While you wait, only an HTTP 400, 401 or 402 or a "failed" status is final. A timeout, a 404 or a 5xx can happen while Superpowers deploys: wait 30 seconds and resend the same request with the same key; GET https://superpowers.tools/v1/runs (same key) shows the steps that are running. Never switch to the step by step path while a run may still be going.

Or run it on your computer: curl -s "https://superpowers.tools/recipes/seedance-video-ad/run.mjs" -o sp-video-ad.mjs, then node sp-video-ad.mjs --<input> "<value>" ... in the foreground with a timeout of at least 6 minutes; it prints one JSON object at the end and nothing before.

## Doing it step by step

Only when neither path above works, and never in addition to another run. Report the total charge as the sum of charge_usd from every call. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool): Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"} (paid tools refuse a call without a key; reuse a key only to retry the same call).

1. Shot description: `openrouter.openai-gpt-5.4-mini` with {"prompt": "<ask for one continuous 60-110 word shot of the product in use, lighting, camera move and sound; no text, logos, brand names or real people>", "max_tokens": 300}.
2. Video: `fal.bytedance-seedance-2.0-mini-text-to-video` (draft, standard) or `fal.bytedance-seedance-2.0-text-to-video` (premium); with a photo use the `-image-to-video` version and add "image_url". Input: {"prompt": "<shot>", "duration": "5", "resolution": "480p" or "720p", "aspect_ratio": "9:16", "generate_audio": true}. Only 480p and 720p, whole seconds; the link to the clip is in video_url.
3. Publish: POST https://superpowers.tools/v1/shares {"title": "<Product>: 5-second video ad", "recipe": "seedance-video-ad", "items": [{"label": "Video", "url": "<video_url>"}, {"label": "Shot description", "text": "<shot>"}]}. Keep "recipe": "seedance-video-ad".

## After the run

Give the user the share link and the video link (the video link expires after some weeks; download it to keep it). Say it is AI-generated. Offer another take with a different shot, the same idea in standard or premium quality, or a version that starts from their product photo.

