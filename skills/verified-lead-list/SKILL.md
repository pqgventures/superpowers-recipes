---
name: verified-lead-list
description: Find the people on one team (marketing, sales, executive, engineering...) at a list of target companies, with roles and work emails checked twice, and the cost per good email, with Superpowers. Use when the user wants leads, contacts or emails for account-based outreach at specific companies.
---

# Verified emails for a team at your target companies

A Superpowers recipe. Give it company websites and a team; for each company it finds up to 10 people on that team with their role, the finder's last verification of each email, and then checks every email again for deliverability. Measured on 2026-10-09 through Superpowers: 8 B2B software companies, marketing team: 50 people, 44 emails marked valid by the finder; on the second check 10 were confirmed deliverable, 40 were at companies whose mail server accepts any address (so they cannot be confirmed either way) and none failed; $0.816 in total. Cost: about $0.052 per company plus $0.008 per email checked again; turn the second check off to pay only the first part.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **companies** (required): company websites separated by commas, up to 15.
- **team** (optional, default marketing): marketing, sales, executive, it, finance, operations, design, support, hr, legal, management, communication, education or health.
- **seniority** (optional): junior, senior or executive.
- **double_check** (optional, default yes): no skips the second check.

Tell the user the cost before running. The result contains names and work emails: give the share link only to the user.

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/verified-lead-list/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"companies": "linear.app, ramp.com, vanta.com", "team": "marketing"}, "idempotency_key": "verified-lead-list-20261009-2130"}'

The run takes about a minute per 50 emails and keeps going on the server. Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds: you get {"status": "running"} until it finishes, then the result with share_url and charge_usd. Make the key unique for each new report (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/verified-lead-list/run. You are charged once however many times you ask. With MCP, call run_recipe with {"recipe": "verified-lead-list", "inputs": {...}, "idempotency_key": "..."} the same way. Never start a run with a new key while one is running, and never mix it with the step by step path. While you wait, only an HTTP 400, 401 or 402 or a "failed" status is final. A timeout, a 404 or a 5xx can happen while Superpowers deploys: wait 30 seconds and resend the same request with the same key; GET https://superpowers.tools/v1/runs (same key) shows the steps that are running. Never switch to the step by step path while a run may still be going.

Or run it on your computer: curl -s "https://superpowers.tools/recipes/verified-lead-list/run.mjs" -o sp-leads.mjs, then node sp-leads.mjs --<input> "<value>" ... in the foreground with a timeout of at least 6 minutes; it prints one JSON object at the end and nothing before.

## Doing it step by step

Only when neither path above works, and never in addition to another run. Report the total as the sum of charge_usd from every call. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool): Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"} (paid tools refuse a call without a key; reuse a key only to retry the same call).

1. For each company: `hunter.domain-search` with {"domain": "<site>", "department": "<team>", "limit": 10} (add "seniority" if asked). Each email has name, position, confidence and verification (valid, accept_all or null).
2. For each email: `millionverifier.verify-email` with {"email": "<email>"}; result ok (deliverable), catch_all (the domain accepts any address), unknown, disposable or invalid. Only if that call fails, use `abstract.email-check` with the same input, one per second; status deliverable, undeliverable or unknown.
3. Count three groups: valid by the finder and deliverable on the second check (confirmed); valid by the finder and catch-all on the second check (the server accepts any address, so it cannot be confirmed: send with care); and undeliverable (do not send). Divide the total charge by the number of people found and by the number confirmed.
4. Publish: POST https://superpowers.tools/v1/shares {"title": "Verified <team> emails at N companies", "recipe": "verified-lead-list", "items": [...one item per company...]}. Keep "recipe": "verified-lead-list".

## After the run

Give the user the share link (private: it has contact data), how many emails were confirmed by both checks, how many are valid by the finder at companies that accept any address, and the cost per person found. Most B2B companies accept any address, so a low confirmed count is normal there; do not call those emails bad. Say which companies returned no one on that team, and offer another team or level. Remind them that catch-all domains accept any address, and to follow anti-spam rules.
