---
name: seo-geo-report
description: Make an SEO and AI-search (GEO/AEO) report for a website with Superpowers: Google rankings per search and who outranks it, monthly search volume and cost per click per search, backlinks against competitors, whether Google's AI Overview names the brand, how often AI assistants with web search mention it against competitors (share of voice), and homepage fixes. Use when the user asks how their site shows up on Google or in ChatGPT, Perplexity, Claude or Gemini answers, wants a Semrush-style check, or wants to compare search visibility with competitors.
---

# SEO and AI-search report for your website

A Superpowers recipe. Give it a website, the brand name and up to 5 searches buyers type (plus competitor websites if you have them). For each search it reads Google's first page and Google's AI Overview; then it asks four AI assistants with web search (OpenAI, Perplexity, Claude and Gemini models) three buyer questions and counts who they name; it looks up monthly Google search volume, cost per click and competition for each search, and the backlink profile (sites linking to it, authority) of the site and up to two competitors; and it audits the homepage for search and AI readiness. Measured on 2026-10-09 for posthog.com with 5 searches and 5 competitors: about $0.26 and 2 to 4 minutes before volume and backlinks; those add about $0.26 for volume and $0.10 per site for backlinks, so about $0.82 in all. When volume or backlinks are not available, the report says so and the rest still runs.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **site** (required): the website, e.g. posthog.com.
- **brand** (required): the name as people write it.
- **keywords** (required): up to 5 searches, separated by commas.
- **competitors** (optional): up to 5 competitor websites, separated by commas.
- **country** (optional, default us): two-letter country for Google.

## Fastest way: let Superpowers run it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/seo-geo-report/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"site": "posthog.com", "brand": "PostHog", "keywords": "product analytics tool, session replay software", "competitors": "amplitude.com, mixpanel.com"}, "idempotency_key": "seo-geo-report-20261009-2130"}'

The run keeps going on the server. Within about 20 seconds you get either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds: you get {"status": "running"} until it finishes, then share_url and charge_usd. Make the key unique for each new report (letters, digits and - _ . : / only, no spaces). If the answer is 402, the balance is too low: tell the user to add funds and stop. A 404 means the address is wrong: it must be a POST to exactly https://superpowers.tools/v1/recipes/seo-geo-report/run. You are charged once. With MCP, call run_recipe with {"recipe": "seo-geo-report", "inputs": {...}, "idempotency_key": "..."}. Never start a second run with a new key while one is running. While you wait, only an HTTP 400, 401 or 402 or a "failed" status is final. A timeout, a 404 or a 5xx can happen while Superpowers deploys: wait 30 seconds and resend the same request with the same key; GET https://superpowers.tools/v1/runs (same key) shows the steps that are running. Never switch to the step by step path while a run may still be going.

## Doing it step by step

Only when the path above does not work, and never in addition to it. Sum charge_usd of every call. With POST https://superpowers.tools/v1/run (or run_tool): Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"} (paid tools refuse a call without a key; reuse a key only to retry the same call).

1. For each search: `litescrape.google-search` and `litescrape.google-ai-overview` with {"q": "<search>", "gl": "us", "hl": "en"}. Find the site's position in organic; check whether the overview text names the brand.
2. `aeo.visibility` with {"brand", "domain", "questions": ["What is the best <search>?", ...up to 3], "competitors": [{"name", "domain"}]}.
3. `seoaudit.page` and `aeoaudit.page` with {"url": "https://<site>/"}.
3b. `dataforseo.keyword-volume` with {"keywords": [<the searches>], "country": "us", "language": "en"} and `dataforseo.backlinks` with {"domain": "<site>"} and once per competitor (up to two). If one of them fails, try `trackee.keyword-volume` with {"keywords": [...]} (add "location": "Brazil" etc. outside the US) or `trackee.backlinks` with {"domain": "<site>"}; if that fails too, skip it and say so in the report.
4. Publish: POST https://superpowers.tools/v1/shares {"title": "<Brand>: SEO and AI-search report", "recipe": "seo-geo-report", "items": [...]}.

## After the run

Give the share link and the one-line summary. Say that rankings and AI answers change from day to day and by country, that the assistants are asked through their APIs with web search (close to, not identical to, the consumer apps), that search volume is Google's monthly average for the country, and that backlink counts come from one crawler's index, so compare sites with each other rather than reading them as exact totals. Offer a monthly rerun to see the trend.
