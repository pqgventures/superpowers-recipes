---
name: funding-signals-watch
description: Check which of a list of target companies just announced a funding round (round, amount, date, news link), when the others last raised, and which other companies in an industry and place raised in the same days, using Superpowers. Use when the user sells to companies and wants to know who just raised money, wants a weekly funding watch on their accounts, or asks which startups in a segment raised recently.
---

# Which of your target accounts just raised money

A Superpowers recipe. Give it the websites of the companies you sell to (up to 25), how many days back to look, and optionally your segment (industry and place). It looks up each company's latest funding round, lists the ones announced inside your window with round, amount, date, size, total raised and the news link, lists your other accounts by their last round date, and adds other companies in your segment that raised in the same days. Measured cost on 2026-10-11: about $1.40 for 10 websites and 9 segment companies ($0.08 per website, $0.20 per 3 segment companies), about 30 seconds. Charged to the user's Superpowers balance; tell the user the cost before you run it.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **accounts** (required): company websites, comma or newline separated, up to 25.
- **days** (optional): 1 to 90, default 30.
- **industry**, **location** (optional): your segment, in plain words (fintech; United States). Leave both empty to skip the segment.
- **segment_size** (optional): 0 to 15 segment companies, default 9.

## Run it: let Superpowers do it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/funding-signals-watch/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"accounts": "ramp.com, dailypay.com, stripe.com, brex.com", "days": "30", "industry": "fintech", "location": "United States", "segment_size": "9"}, "idempotency_key": "funding-watch-20261011-0930"}' > result.json

Each request returns within about 30 seconds with either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key until it stops answering running; you are charged once. Make the key unique for each new run (letters, digits and - _ . : / only). If the answer is 402, the balance is too low: tell the user and stop. With MCP, call run_recipe with {"recipe": "funding-signals-watch", "inputs": {...}, "idempotency_key": "..."}.

Run it once: if a request times out, resend it with the same idempotency_key; never pick a new key for the same list, never download or run a script for this recipe, and never mix in manual lookups. Keep the API key in the SUPERPOWERS_API_KEY environment variable; never write it into a file.

The finished answer has share_id, share_url, charge_usd and steps. Do not build your answer from the steps. Read the result with GET https://superpowers.tools/v1/shares/<share_id> (same Authorization header): its items are the summary, the accounts that raised, your other accounts by last round, and the segment companies.

## Doing it step by step

Only when the request above answers an error other than running or 402 (for example 404 or 500), and never in addition to it. Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"}; report the sum of charge_usd of every call.

1. Each website: `fundable.company-funding` with {"domain": "<website>"}. A round counts when its announced date is inside the window.
2. Segment: `fundable.funded-companies` with {"industry": "<industry>", "location": "<place>", "days": <days>, "limit": 3, "page": 0}, then page 1, 2 while next_page is not null. Leave out companies already on the list.
3. Publish: POST https://superpowers.tools/v1/shares {"title": "<N> of your accounts just raised money", "recipe": "funding-signals-watch", "items": [a summary, one item per account that raised {"label": "<company>", "url": "<news link>", "caption": "<round · amount · date · size · total raised · summary>"}, one item listing the others by last round, one item per segment company]}.

## After the run

Give the user the share_url and the accounts that raised, exactly as the share's items list them: round, amount (or "not disclosed"), date and the news link. Add nothing the items do not say. If the user wants outreach lines, write them yourself from the round summary and the news article, one line each, and tell them to read the article first. Amounts and dates are what the announcement said, and late announcements can be missing. Suggest running it again every Monday with the same list.

