---
name: lead-openers
description: Write the first line of a cold email for each target company from its real recent news (a launch, a hire, a funding round), with the story and link each line is based on, with Superpowers. Use when the user wants personalized outreach openers, icebreakers or follow-ups for a list of companies.
---

# Opening lines from each company's latest news

A Superpowers recipe. Give it up to 8 company websites and what you sell; it reads each company's news from the last 90 days (grouped by event), picks a story about the company itself (skipping comparison pages and rivals' posts), and writes one opening line per company that mentions it, with the headline, date and link. A line whose numbers are not in its story is dropped, and companies with no story about themselves get none. Measured on 2026-10-09: 4 companies, 3 openers, about $0.10 and under a minute.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **companies** (required): company websites separated by commas, up to 8.
- **offer** (required): what you sell, in a few words.

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/lead-openers/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"companies": "ramp.com, linear.app, vanta.com", "offer": "a tool that turns customer calls into product feedback reports"}, "idempotency_key": "lead-openers-20261009-2130"}'

The run takes under a minute. Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds until it stops answering running. Make the key unique for each new run (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/lead-openers/run. You are charged once. With MCP, call run_recipe with {"recipe": "lead-openers", "inputs": {...}, "idempotency_key": "..."}. Never start a second run with a new key while one is running.

## Doing it step by step

Only when the path above does not work, and never in addition to it. Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"}; sum charge_usd of every call.

1. For each company: `akta.company-news` with {"company": "<site>", "limit": 6, "since": "<90 days ago, YYYY-MM-DD>"}.
2. One LLM call (`openrouter.openai-gpt-5.4-mini`) picks a story about the company itself per company by ref and writes one sentence; copy the headline, date and link yourself, and drop lines with numbers the story lacks.
3. Publish: POST https://superpowers.tools/v1/shares {"title": "Opening lines for N companies", "recipe": "lead-openers", "items": [...]}.

## After the run

Give the share link. Remind the user to read each line against its story before sending and to follow anti-spam rules. Offer to pair it with verified emails for the same companies (recipe verified-lead-list).

