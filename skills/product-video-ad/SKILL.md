---
name: product-video-ad
description: Turn a product page into a 25-35 second vertical video ad (Reels, TikTok, Shorts) with the page's own photos, its real facts on screen, a natural AI voice and captions, with Superpowers. Use when the user wants a product video ad, a short promo clip or a social video for something they sell, without a video editor or an agency.
---

# Video ad from your product page

A Superpowers recipe in two runs. Run 1 reads the product page and gives you its facts and photos. You write 4 to 6 scenes from them. Run 2 checks that every number in your scenes appears on the page, then renders a 1080x1920 video with the page's photos shown whole, a natural AI voice (ElevenLabs Eleven v4) and an on-screen label saying the voice is AI. Measured cost on 2026-10-10: about $0.01 for run 1 and $0.26 for run 2. Run 2 takes about 20 seconds. Charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **url** (required): the product's own page (not the home page or a collection).
- **scenes** (leave empty for run 1): one scene per line, `photo number | on-screen text | what the voice says | optional small caption`.
- **voice** (optional): jessica (bright, default), sarah (reassuring), laura (enthusiastic), george (British), brian (deep), liam (energetic).

Use it for the user's own product, or one they may advertise. Tell the user the cost before run 2.

## Fastest way: run the script

    curl -s "https://superpowers.tools/recipes/product-video-ad/run.mjs" -o sp-product-video.mjs
    node sp-product-video.mjs --url "https://example.com/products/thing" > facts.json

Read facts.json: the photos (numbered) and what the page says. Then write the scenes yourself and run again:

    node sp-product-video.mjs --url "https://example.com/products/thing" --scenes "1 | Still want a cola? | Still want a cola? Meet Vintage Cola.
    3 | 6g of fiber in a cola | It is a cola with 6 grams of fiber.
    ..." > video.json

Each run prints one JSON object (share_url, charge_usd, items). Report only that run's numbers and add the two charges together.

## Writing the scenes

- 4 to 6 scenes, about 25 to 35 seconds in total (under 700 characters of voice): a hook, two or three facts that matter to the buyer, the offer, a call to action.
- Use only facts that are on the page. Write every number as digits, on screen and in the voice ("6 grams", "$35.99"): run 2 refuses any number the page does not show.
- On-screen text short (under 8 words); the voice can say a little more.
- Pick the photo that shows what the line says (the can for the hook, the nutrition panel for numbers, the pack for the price).
- Take facts only from the product's own section (its title, buy box, description and nutrition or spec panel). Product pages also show cards for other products, and their offers and figures pass the number check; on the OLIPOP example a "Save 15%" offer belonged to other flavors.
- Keep health, results and comparison claims in the page's own words ("supports digestive health" stays that, not "good for your gut"); the number check cannot catch reworded claims.
- If the page says the product is out of stock or a price is a subscription price, say so or leave that line out.

## Doing it step by step

Only when you cannot run Node or Bun. Report the total charge as the sum of charge_usd from every call.

1. Page: `firecrawl.scrape` with {"url": "<product page>"}. Photos are the image links in the markdown (skip icons and logos); facts are in the text.
2. Write the scenes as above and check every number against the page text yourself.
3. Video: `videokit.vertical-video` with {"disclosure": "Facts and photos from <site> · AI voice", "voice": "jessica", "scenes": [{"image_url": "<photo>", "text": "<on screen>", "narration": "<voice>", "caption": "<optional>", "fit": "contain"}, ...]}.
4. Publish: POST https://superpowers.tools/v1/shares {"title": "<Product>: video ad from the product page", "recipe": "product-video-ad", "items": [{"label": "Video", "url": "<video_url>"}, {"label": "Scenes", "text": "<one line per scene>"}]}.

## After the run

Give the user the share_url and the video link. Remind them the voice is AI (the label stays on screen) and to check the facts against their current offer before posting.

