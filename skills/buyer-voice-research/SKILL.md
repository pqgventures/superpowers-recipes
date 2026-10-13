---
name: buyer-voice-research
description: Find what buyers in a category complain about, ask and want on Reddit, grouped into themes with word-for-word quotes and thread links, with Superpowers. Use when the user wants customer research, voice-of-customer, objections, pain points, ad angles or messaging in buyers' own words, or wants to know why people leave a competitor.
---

# What buyers complain about, from Reddit

A Superpowers recipe. Give it a category (and up to 3 competitors); it searches Reddit with buyer phrases (too expensive, best for a small team, frustrating, <competitor> alternative), keeps only threads by people choosing or using tools in the category, reads up to 6 of the busiest, and groups their comments into themes with word-for-word quotes, counts and links. Measured on 2026-10-09 for product analytics with Mixpanel and Amplitude: 45 comments in 6 threads, 5 themes, about $0.07, about a minute.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **category** (required): what you sell, as buyers say it.
- **competitors** (optional): up to 3 names, separated by commas.
- **timeframe** (optional): month or year (default year).

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/buyer-voice-research/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"category": "product analytics", "competitors": "Mixpanel, Amplitude"}, "idempotency_key": "buyer-voice-20261009-2130"}'

Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds until it stops answering running. Make the key unique for each new report (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/buyer-voice-research/run. You are charged once. With MCP, call run_recipe the same way. Never start a second run with a new key while one is running. While you wait, only an HTTP 400, 401 or 402 or a "failed" status is final. A timeout, a 404 or a 5xx can happen while Superpowers deploys: wait 30 seconds and resend the same request with the same key; GET https://superpowers.tools/v1/runs (same key) shows the steps that are running. Never switch to the step by step path while a run may still be going.

## Doing it step by step

Only when the path above does not work, and never in addition to it. Sum charge_usd of every call: Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"} (paid tools refuse a call without a key; reuse a key only to retry the same call).

1. `scrapecreators.reddit-search` with {"query": "<phrase>", "sort": "relevance", "timeframe": "year"} for each phrase.
2. Keep threads about choosing or using tools in the category (not careers or courses), with 3+ comments; read up to 6 with `scrapecreators.reddit-comments` {"url": "<post url>", "limit": 25}.
3. Group comments into themes with an LLM that returns comment refs only; copy the quotes yourself from the comments and count per theme.
4. Publish: POST https://superpowers.tools/v1/shares {"title": "What <category> buyers say on Reddit", "recipe": "buyer-voice-research", "items": [...]}.

## After the run

Give the share link and the biggest theme. Say the counts are comments in this sample, not market shares, and that quotes are public comments shown without usernames. Offer ad headlines or landing-page copy written from the top two themes.

