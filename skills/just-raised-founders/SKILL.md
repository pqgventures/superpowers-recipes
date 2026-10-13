---
name: just-raised-founders
description: Find founders of startups that just raised money, with Superpowers - startups whose seed or Series A (or other round) was announced in the last days in a place and industry you pick, with amount, date and news link, the founder's name with the sentence it came from, and the founder's verified work email. Use when the user wants freshly funded startups to sell to, or founders to email after a funding round.
---

# Founders of startups that just raised

A Superpowers recipe. Pick a place, an industry and the rounds. It lists the startups that announced that round in the last days (amount, date, city, the news article), reads the founder's name from news and profiles about each one, and finds that founder's verified work email at the company's website. Names are read in code from sentences that call someone the founder or CEO; the sentence and its link come back with each name so the user can check it. Typical cost: about $0.20 per 3 startups, 1 cent per founder search and 8 cents per email lookup, charged to the user's Superpowers balance (about $0.45 for 3 startups).

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **location** (default United States): city, state or country in plain words.
- **industry** (default software): plain words (fintech, healthcare, artificial intelligence).
- **stages** (default seed, series-a): pre-seed, seed, series-a, series-b, series-c, separated by commas.
- **days** (default 7): round announced in the last N days, 1 to 60.
- **companies** (default 6): 3, 6 or 9.

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/just-raised-founders/run.mjs" -o sp-just-raised.mjs
    node sp-just-raised.mjs --location "United States" --industry software --stages "seed, series-a" --days 7 --companies 3

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the result.

## Doing it step by step

Only when the script cannot be used. POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. fundable.funded-companies with {"location": "...", "industry": "...", "stages": ["seed", "series-a"], "days": 7, "limit": 3, "page": 0}; ask page 1, 2 for more. Each company has domain, round, amount_usd, announced, round_summary and source.
2. For each company, linkup.search with {"query": "<company> <domain> founder CEO", "max_results": 8}. Read the results yourself and pick the person a source calls the founder or CEO of this company; keep the sentence and link.
3. findymail.find-email with {"name": "<founder>", "domain": "<domain>"}. found false means no verified email; do not guess one.

## After the run

Give the user the share_url and the table. Say that names are read from public pages and should be checked before writing, that job titles in email data can be old (use the title from the news), and that the list is the first few of the total Fundable reports. Do not invent an email when none was found. If the user will email these founders, remind them to follow anti-spam rules for their country.
