---
name: ad-concepts
description: Make three different ad visuals plus a headline for a product with Superpowers, then give the user a link where their team votes for the winner. Use when the user wants ad creatives, campaign concepts or visual options for a product or offer.
---

# Three ad concepts to choose from

A Superpowers recipe. It writes one headline and makes three ad images in different styles (bold studio shot, candid lifestyle photo, editorial illustration), then publishes a page where anyone with the link can pick their favourite. Typical cost: about $0.17 per run, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?src=github

## Inputs

- **product** (required): what is being advertised, in a few words.
- **audience** (optional, default "small business owners"): who it's for.

Ask the user for the product if it isn't clear. Mention the cost before the first run.

## Fastest way: run the script

    curl -s "https://superpowers.tools/recipes/ad-concepts/run.mjs" -o sp-ad-concepts.mjs
    node sp-ad-concepts.mjs --product "cold brew coffee subscription" --audience "remote workers"

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key, runs the four steps (images in parallel, about a minute), and prints JSON with share_url, charge_usd and each step's output. Add --no-share to skip the voting page. Bun works too.

## Doing it step by step

If you can't run scripts, make the same calls yourself with POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. Headline: tool openai.gpt-5.4-mini, input {"prompt": "You are a senior copywriter. Write one ad headline (max 7 words) for <product>, aimed at <audience>. Concrete benefit, no clichés, no exclamation marks. Reply with the headline only, no quotes.", "max_tokens": 40}.
2. Three images with tool openai.gpt-image-2.5-sunburst, one call each (run them in parallel):
   - "Premium minimalist product advertisement for <product>, aimed at <audience>. A single hero subject photographed in a studio, bold saturated solid-color backdrop, crisp hard light with a long graphic shadow, generous negative space for a headline, art-directed like a global brand campaign. No text, no logos."
   - "Candid lifestyle advertising photograph: <audience> enjoying <product> in a real, lived-in setting. Soft natural window light, shallow depth of field, authentic expressions, warm editorial color grade, shot on a 35mm lens. No text, no logos."
   - "Contemporary editorial illustration advertising <product> for <audience>. Confident graphic shapes, subtle paper grain texture, limited palette of three or four harmonious colors, clear focal point, the polish of a premium magazine cover. No text, no logos."
3. Publish: POST https://superpowers.tools/v1/shares {"title": "<Product>: three ad concepts", "review": true, "question": "Which ad should we run?", "recipe": "ad-concepts", "items": [{"label": "Headline", "text": ...}, {"label": "Bold & minimal", "url": ...}, {"label": "Lifestyle photo", "url": ...}, {"label": "Illustrated", "url": ...}]}.

## After the run

Give the user the share_url as the main result and tell them they can send it to their team or client; nobody needs an account to vote. When they come back, read the votes and comments with GET https://superpowers.tools/v1/shares/<share_id> and continue with the winner (more variations, other sizes, ad copy).

You can adapt the prompts to the user's brand, change the styles, or make more than three; it's a starting point, not a fixed pipeline.
