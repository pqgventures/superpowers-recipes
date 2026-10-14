---
name: serp-competitor-snapshot
description: See who ranks on Google for a keyword and how each top page pitches itself, with Superpowers (Google search, then each page read as text). Use when the user asks who ranks for a keyword, who their search competitors are, or how the top results position themselves.
---

# Who ranks for your keyword

A Superpowers recipe. It searches Google for one keyword in the user's country and language, opens the top 3 pages (up to 5) and returns each page's headline and the text it leads with, linked, on one share page. Typical cost: under 1¢ per run, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?src=github

## Inputs

- **keyword** (required): what customers type into Google, for example "marketing agency".
- **country** (optional, default "us"): two-letter country code, for example br or gb.
- **language** (optional, default "en"): two-letter language code, for example pt.
- **top** (optional, default 3): how many results to open, 1 to 5.

## Fastest way: run it on Superpowers

POST https://superpowers.tools/v1/recipes/serp-competitor-snapshot/run {"inputs": {"keyword": "marketing agency", "country": "us"}, "idempotency_key": "<unique per run>"} (or the run_recipe MCP tool). It returns share_url, charge_usd and each step's output.

Or run the script with your key:

    curl -s "https://superpowers.tools/recipes/serp-competitor-snapshot/run.mjs" -o sp-serp.mjs
    node sp-serp.mjs --keyword "marketing agency" --country us

## Doing it step by step

1. Tool `serper.google-search` with {"query": "<keyword>", "country": "<country>", "language": "<language>", "num": 10}.
2. For each of the top results: tool `jina.reader` with {"url": "<result url>"}. A page that fails to load keeps its search snippet.
3. Publish: POST https://superpowers.tools/v1/shares {"title": "Who ranks for <keyword>", "recipe": "serp-competitor-snapshot", "items": [{"kind": "link", "url": "<url>", "label": "#<position> <domain>", "text": "<page title and opening>"}]}.

## After the run

Give the user the share_url, then say in your own words what the top pages have in common and where they differ (offer, audience, proof). Offer next steps: the same keyword in another country, or `seo-geo-report` for a full audit of the user's own page.

