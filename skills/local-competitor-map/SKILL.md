---
name: local-competitor-map
description: Map a local business's nearest competitors on Google Maps with Superpowers (distance, rating, reviews, what each homepage leads with, booking or appointment-request wording) and write a positioning brief with three angles and three quick wins. Use when a local business (dentist, med spa, gym, salon, restaurant, home services) or its agency wants to see the local competition, benchmark Google reviews, or find how to stand out in its neighborhood.
---

# Local competitor map

A Superpowers recipe. Give it a business name as it appears on Google Maps, what it is (the search a customer would type) and the city. It finds the business and its 15 nearest competitors among the returned Google Maps results, places them on a map, reads each homepage (headline, booking or appointment-request wording, mentions such as membership, financing and insurance), computes the medians and counts in code and writes a brief: where you stand, what the neighborhood competes on, three positioning angles and three quick wins. Recorded example: about $0.05, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **business** (required): the name as it appears on Google Maps, for example "Smile Haus Austin".
- **kind** (required): what a customer would search on Maps, for example dentist, med spa, gym, plumber.
- **city** (required): city and state or country, for example "Austin, TX".

Ask for anything that is missing. Mention the cost before the first run.

## Use the script (preferred)

Use the script unless the user asks for something it does not do; it makes every call, computes the numbers and publishes the share page in one go.

    curl -s "https://superpowers.tools/recipes/local-competitor-map/run.mjs" -o sp-local-map.mjs
    node sp-local-map.mjs --business "Smile Haus Austin" --kind dentist --city "Austin, TX"

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the result: a brief, a table of competitors by distance, the computed numbers and the map data (lat, lng, reviews, rating per business).

## Doing it step by step

Only when the script cannot be used. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. Tool `serper.google-places` four times, input {"query": "<kind>" | "best <kind>" | "top rated <kind>" | "<kind> near <business>", "location": "<city>"}. Merge the places, dropping duplicates. Find the business among them; if it is missing, search its name.
2. Coordinates: use latitude and longitude from the place when present; otherwise tool `photon.geocode` with {"query": "<street address without the suite>", "limit": 1} (free). Compute distances in code and keep the 15 nearest.
3. For each website: tool `jina.reader` {"url": "<website>"}; if it fails or returns a bot check, retry once with `firecrawl.scrape` (same input). Take the title and first heading; check the page text for booking links and for offers (free consultation, new customer offer, insurance, financing, membership, Spanish, awards, guarantee). A page that fails to load or shows a bot check ("Just a moment", "Robot Challenge") is "unknown", not "no"; never draw conclusions from it. Other locations of the same business (same website) are not competitors, and a geocoded point more than 50 km from the city is a wrong match: drop it.
4. Compute in code: median rating and reviews, how many have more reviews and a higher rating than the business, how many contain booking or appointment-request wording, and how many homepages mention each offer. Never ask the LLM to compute these.
Verify the matched visible text before interpreting a signal. Strip link destinations from wording counts. Do not infer hours from day names next to “Closed”, or emergency services from same-day procedures or patient reviews. Booking wording does not establish online booking availability; a missing match is not a missing service.

5. Write the brief with an LLM (for example `openrouter.anthropic-claude-sonnet-5`, {"prompt": ..., "max_tokens": 2500}) from those numbers and the per-business facts, telling it to use the numbers unchanged and invent nothing.
6. Publish: POST https://superpowers.tools/v1/shares {"title": "Local competitor map: <business>, <city>", "recipe": "local-competitor-map", "items": [{"label": "Brief", "text": "..."}, {"label": "Competitors by distance", "text": "..."}]}.

Add up charge_usd from every call and report that total.

## After the run

Give the user the share_url and the three quick wins. If they want a picture, draw the map from the map data: one numbered dot per business, sized by reviews, the user's business highlighted, with a legend listing the numbers (labels overlap when businesses share a building). Say that Google Maps results carry no review text, so the brief does not claim what reviewers say, and that positions come from geocoded addresses. Offer next steps: the same map for a second location, `competitor-ad-teardown` for the competitors that advertise, or `ad-concepts` to turn a positioning angle into ad visuals.
