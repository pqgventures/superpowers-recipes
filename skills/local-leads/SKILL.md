---
name: local-leads
description: Find local businesses of any type in a city from Google Maps, with phone, address, website, rating and reviews, and optionally public emails from their websites, with Superpowers. Use when the user wants a list of local leads to call or email (dentists in Campinas, gyms in Austin, restaurants in Lisbon).
---

# Find local leads with phone numbers

A Superpowers recipe. It pulls up to 20 businesses of one kind in one city from Google Maps, each with phone, address, website, rating and number of reviews, and publishes them as one list. With emails=yes it also looks up public emails on each business's website. Typical cost: under 1¢ per run without emails, about 5¢ more per business with emails, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?src=github

## Inputs

- **query** (required): what you would search on Google Maps, for example "dentist".
- **location** (required): city and state or country, for example "Campinas, SP".
- **max** (optional, default 10): how many businesses, up to 20.
- **emails** (optional, default "no"): "yes" to look up public emails on each website. Say what it adds to the cost before turning it on.
- **country**, **language** (optional): two-letter codes for the Maps search.

## Fastest way: run it on Superpowers

POST https://superpowers.tools/v1/recipes/local-leads/run {"inputs": {"query": "dentist", "location": "Campinas, SP"}, "idempotency_key": "<unique per run>"} (or the run_recipe MCP tool). It returns share_url, charge_usd and each step's output.

Or run the script with your key:

    curl -s "https://superpowers.tools/recipes/local-leads/run.mjs" -o sp-leads.mjs
    node sp-leads.mjs --query dentist --location "Campinas, SP"

## Doing it step by step

1. Tool `serper.google-places` with {"query": "<query>", "location": "<location>"}. Keep the first <max> places.
2. Only if the user wants emails: for each place with a website, tool `hunter.domain-search` with {"domain": "<website domain>", "limit": 3}.
3. Publish: POST https://superpowers.tools/v1/shares {"title": "<n> <query> in <location>", "recipe": "local-leads", "items": [{"kind": "link", "url": "<website>", "label": "<name>", "text": "<phone>, <address>, ★ <rating> (<reviews> reviews)"}]}.

## After the run

Give the user the share_url, and offer the list as a CSV if they want to load it into a CRM. Contact details come from public sources; remind them to follow anti-spam rules when they write. Next steps: `verified-lead-list` for named people at bigger companies, or `local-competitor-map` to compare one business with its neighbors.

