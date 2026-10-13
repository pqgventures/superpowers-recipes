---
name: weekly-ads-review
description: Review last week's ads from a Meta, Google, TikTok or LinkedIn ads export with Superpowers: spend, results, cost per result and return per campaign, warnings about wasted spend, and three actions for next week (scale, fix, test), each citing the numbers it rests on. Use when the user shares an ads export or asks how their campaigns did and what to change.
---

# Weekly review of your ads from the export

A Superpowers recipe. Give it last week's ads export (paste the CSV or a link); it computes totals and per-campaign spend, results, cost per result and return on spend, flags campaigns that spend without results, miss the target or fall far from the others, and writes three actions for next week that cite those numbers. Reading the export is free; the written actions cost about a tenth of a cent. Measured on 2026-10-09 on a sample export: $0.0015, a few seconds.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **csv** or **csv_url** (one is required): the export from the ads platform (English or Portuguese headers, US or BR number formats).
- **target_cpa** (optional): your target cost per result.

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/weekly-ads-review/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"csv_url": "https://example.com/last-week.csv", "target_cpa": "40"}, "idempotency_key": "weekly-ads-review-20261009-2130"}'

The run takes a few seconds. Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds until it stops answering running. Make the key unique for each new run (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/weekly-ads-review/run. You are charged once. With MCP, call run_recipe with {"recipe": "weekly-ads-review", "inputs": {...}, "idempotency_key": "..."}. Never start a second run with a new key while one is running.

## Doing it step by step

Only when the path above does not work, and never in addition to it. Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"}:

1. `adsreport.analyze` with {"csv": "<export>"} or {"csv_url": "<link>"}, "group_by": "campaign", optional "target_cpa".
2. One LLM call writes three actions (scale, fix, test) from those numbers only, each naming its campaign.
3. Publish: POST https://superpowers.tools/v1/shares {"title": "Weekly ads review", "recipe": "weekly-ads-review", "items": [...]}.

## After the run

Give the share link and the three actions. Say the numbers come from the export as the platform reported them; attribution windows differ by platform. Offer to run it every Monday.

