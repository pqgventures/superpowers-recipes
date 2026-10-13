---
name: private-company-profile
description: Build a PitchBook-style profile of a private company from its website with Superpowers: what it does, ownership, founded year, headcount band, funding rounds with amounts and sources, open roles by team, and recent news grouped by event; revenue and valuation estimates, leaders and business model when the full profile is available. Use when the user researches a private company, a competitor, an acquisition target, an investor's portfolio company or a sales prospect.
---

# Private company profile from a website

A Superpowers recipe. Give it a company website; it returns a one-page profile in which every line keeps its source: what the company does, ownership (founder-owned, VC-backed, PE-backed), status, founded year, headcount band, funding rounds with dates and amounts, open roles grouped by team, and the last six months of news grouped by event. When the full profile is available it adds revenue and valuation estimate bands, leaders, how the company makes money, customer segments and strategic moves. Measured on 2026-10-10 for ramp.com: basics, 6 funding rounds, 50+ open roles and news for $0.275 (basics $0.13, news $0.025, funding $0.06, roles $0.06). The full profile costs $0.62 in place of the basics' $0.13, about $0.77 in all. Charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **company** (required): the company's website, e.g. ramp.com.

Tell the user the cost before running.

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/private-company-profile/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"company": "ramp.com"}, "idempotency_key": "private-company-profile-20261010-0900"}'

The run takes under a minute and keeps going on the server. Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds: you get {"status": "running"} until it finishes, then the result with share_url and charge_usd. Make the key unique for each new profile (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/private-company-profile/run. You are charged once however many times you ask. With MCP, call run_recipe with {"recipe": "private-company-profile", "inputs": {"company": "..."}, "idempotency_key": "..."} the same way. Never start a run with a new key while one is running, and never mix it with the step by step path. While you wait, only an HTTP 400, 401 or 402 or a "failed" status is final. A timeout, a 404 or a 5xx can happen while Superpowers deploys: wait 30 seconds and resend the same request with the same key; GET https://superpowers.tools/v1/runs (same key) shows the steps that are running. Never switch to the step by step path while a run may still be going.

Or run it on your computer: curl -s "https://superpowers.tools/recipes/private-company-profile/run.mjs" -o sp-company.mjs, then node sp-company.mjs --company ramp.com in the foreground with a timeout of at least 3 minutes; it prints one JSON object at the end and nothing before.

## Doing it step by step

Only when neither path above works, and never in addition to another run. Report the total as the sum of charge_usd from every call. Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"} (paid tools refuse a call without a key; reuse a key only to retry the same call).

1. `akta.company-profile` with {"company": "<site>"}. If it is not available or fails, use `akta.company-firmographics` with the same input (basics only) and say so.
2. `akta.company-news` with {"company": "<site>", "limit": 15}.
3. `predictleads.company-signals` with {"domain": "<site>", "signal": "funding", "limit": 20}, and again with "signal": "jobs", "limit": 50.
4. Publish: POST https://superpowers.tools/v1/shares {"title": "<Name>: company profile", "recipe": "private-company-profile", "items": [...]}, keeping every source link next to its line. Keep "recipe": "private-company-profile".

## After the run

Give the user the share link and the cost. Say that headcount, revenue and valuation are estimate bands from public sources, not reported numbers; that funding rounds come from news coverage, so the newest round may appear in the news before the rounds list; and that very small or very new companies can have thin coverage. Offer the same profile for competitors to compare.
