---
name: niche-weekly-digest
description: Gather the week's news stories in a niche for a newsletter with Superpowers, ranked by how many different outlets covered each story, with the original article link, date and opening lines, leaving out listicles, paid placements and price pages; then write the newsletter in the user's voice. Use when the user wants a weekly newsletter or roundup about their industry without a writer, asks what happened this week in their niche, or wants story ideas with sources.
---

# This week's stories in your niche, ready for your newsletter

A Superpowers recipe. Give it your niche and up to 5 topics your readers care about. It searches the last days of news for each topic, leaves out listicles ("6 best agencies"), paid placements, press-release wires and price pages, groups articles about the same story, ranks stories by how many different outlets covered them, and finds each story's original article with its opening lines. You (the agent) then write the newsletter from that material. Measured on 2026-10-11 for ecommerce with 5 topics and 10 stories: about $0.10 and under a minute. Charged to the user's Superpowers balance; tell the user the cost before you run it.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **niche** (required): what the newsletter is about, in plain words (ecommerce, fintech, coffee shops).
- **topics** (optional): up to 5 searches, comma separated (Shopify merchants, TikTok Shop sellers, Meta ads). Without them it searches the niche itself.
- **days** (optional): 1 to 30, default 7.
- **stories** (optional): 3 to 12, default 10.

## Run it: let Superpowers do it

    curl -s -m 60 -X POST "https://superpowers.tools/v1/recipes/niche-weekly-digest/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"niche": "ecommerce", "topics": "Shopify merchants, ecommerce marketing, TikTok Shop sellers, Amazon sellers, Meta ads", "days": "7", "stories": "10"}, "idempotency_key": "digest-ecommerce-20261011"}' > result.json

Each request returns within about 30 seconds (the whole run takes about a minute) with either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key until it stops answering running; you are charged once. Make the key unique for each new run (letters, digits and - _ . : / only). If the answer is 402, the balance is too low: tell the user and stop. With MCP, call run_recipe with {"recipe": "niche-weekly-digest", "inputs": {...}, "idempotency_key": "..."}.

Run it once per issue: pick the idempotency_key before the first request and reuse it for every resend, even after a timeout or an empty answer; never pick a new key for the same run, never download or run a script for this recipe, and never mix in your own searches. Keep the API key in the SUPERPOWERS_API_KEY environment variable; never write it into a file.

The finished answer has share_id, share_url, charge_usd and steps. Do not build your answer from the steps. Read the result with GET https://superpowers.tools/v1/shares/<share_id> (same Authorization header): its items are a summary, one item per story (label: the headline; url: the article link; text: the article's opening lines, when found; caption: the outlets that covered it and the date), and a note on how to use it.

## Doing it step by step

Only when the request above answers an error other than running or 402 (for example 404 or 500), and never in addition to it. Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"}; report the sum of charge_usd of every call.

1. Each topic: `search1api.news` with {"query": "<topic>", "time_range": "week", "max_results": 20}. Titles end with " - <outlet>". Leave out listicles, press-release wires and price pages.
2. Group articles about the same story and rank stories by the number of different outlets.
3. Each top story: `exa.search` with {"query": "<headline>", "num": 3} and keep the first result that is the same article (not a news.google link).
4. Publish: POST https://superpowers.tools/v1/shares {"title": "This week in <niche>: <N> stories", "recipe": "niche-weekly-digest", "items": [a summary, one item per story {"label": "<headline>", "url": "<article link>", "text": "<opening lines>", "caption": "<outlets · date>"}]}.

## After the run: write the newsletter

Give the user the share_url, then write the newsletter yourself from the share's items:

- A subject line and a two-sentence intro in the user's voice (ask for a past issue or three adjectives if you do not know it).
- Pick the 5 to 8 stories their readers would forward. Skip items whose caption starts with "Press release" or "Investor news" unless the readers are investors, and skip items that only share a word with a topic (a shipping-container house is not shipping news).
- Each story: a short headline, two or three sentences on what happened and why it matters to these readers, and the link with the outlet name. Use only what the item's text and the article say; open the link before you add a detail.
- Copy facts, do not add them: every number, place, name and date in the issue must appear in the item's text or in the article you opened. Do not guess causes or forecasts ("probably temporary"). If an item has no text (no opening lines), read the article or leave the story out.

Say that the outlet counts come from one news search, so they show which stories spread, not exact totals. Offer to run it every Monday with the same topics.

