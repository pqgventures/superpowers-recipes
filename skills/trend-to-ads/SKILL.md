---
name: trend-to-ads
description: Find this week's most-liked TikTok videos in a niche with Superpowers, see the hooks and formats that keep working (with plays, likes, saves and links), and get three ad concepts for your product with a vertical image each. Use when the user wants to know what is trending in their niche, wants ad or content ideas based on current TikTok trends, or asks what creative is working right now.
---

# Trend to ads

A Superpowers recipe. Give it a niche (what people search on TikTok) and what you sell. It pulls the most-liked TikTok videos in that niche from the chosen window, keeps the ones that are really about the niche, computes the medians, save rates and share rates in code, and writes what is working with links to the videos, plus three ad concepts (hook, beats, caption, call to action) with one generated vertical image each. Typical cost: about $0.15, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **niche** (required): what people search on TikTok, for example "protein snacks".
- **product** (required): what the user sells, in a few words.
- **period** (optional): yesterday, this-week (default) or this-month.

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/trend-to-ads/run.mjs" -o sp-trend-to-ads.mjs
It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints a long JSON. Save it to a file, then read the two numbers you report:

    node sp-trend-to-ads.mjs --niche "skincare routine" --product "a vitamin C serum" > trend.json
    node -e 'const r=require("./trend.json"); console.log(r.status, r.share_url, r.charge_usd)'

Report only what this run returned: its share_url, its charge_usd (the real total) and the findings in its result items. If the status is not completed, say what failed; never fill in numbers or links from anywhere else.

## Doing it step by step

Only when the script cannot be used. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. Tool `scrapecreators.tiktok-search`, input {"query": "<niche>", "period": "this-week", "sort": "most-liked"}. Give each video a short ref (V1, V2...).
2. With an LLM (for example `openrouter.openai-gpt-5.4-mini`), classify each video as on-topic or not from its caption, and give each on-topic one a format (howto, product, talk, other), as JSON. Keep the on-topic ones.
3. Compute in code: median plays, likes and length, save rate and share rate (saves or shares divided by plays) for videos with at least 50,000 plays, top hashtags, and plays by length (under 30, 30 to 60, over 60 seconds; mark a group with fewer than 4 videos as too few to compare). Then saves per 100 plays per format, pooled and by median: a format leads only with 4+ videos and when it beats every other format (3+ videos) on both.
4. Ask the LLM for the brief and three concepts, giving it the finding from step 3: the brief starts from it, and when a format leads, every concept uses that format and is based on one of its videos, citing videos only by ref; replace each ref in code with @handle (N plays). Every number in the brief must come from step 3; no ranges or conclusions from groups under 4 videos. Never let the model copy video ids. No quotation marks unless the words are in a caption.
5. One image per concept with `openrouter.google-gemini-2.5-flash-image.image`, {"prompt": "<scene>, vertical, no text, no logos", "size": "portrait"}.
6. Write the numbers as plain sentences (no JSON) and list the top videos with their links. Publish: POST https://superpowers.tools/v1/shares {"title": "Trend to ads: <niche>", "recipe": "trend-to-ads", "items": [...]}.

Add up charge_usd from every call and report that total.

## After the run

Give the user the share_url and the three concepts. Say that counts are what TikTok reported at the time of the run, that most-liked is a signal of what resonates (not of what converts), and that the concepts do not copy any creator. Offer next steps: the same search for this-month, `competitor-ad-teardown` to see the paid ads in the category, or `ad-concepts` for more visuals of one concept.
