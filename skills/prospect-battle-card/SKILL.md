---
name: prospect-battle-card
description: Prepare for a sales call with Superpowers: give a prospect's website and what you sell, get a one-page battle card with what they do, what Google says about them, competitors, suggested job roles without personal names or contact details, five talking points for your product and three discovery questions, every claim tied to a numbered source. Use when the user has a sales call or demo coming up, wants to research a prospect or account, or asks for a battle card or meeting prep on a company.
---

# Prospect battle card

A Superpowers recipe. Give it the prospect's domain and what you sell. It reads the prospect's homepage, runs two Google searches (news, competitors), uses available job titles at the domain without displaying personal details, and writes a one-page card: what they do, what the news says, competitors, talking points that connect your product to what the sources say, discovery questions and who to contact first. Every claim ends with a source number; personal names and contact details are omitted. Recorded example: about $0.06, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **domain** (required): the prospect's website, for example linear.app.
- **product** (required): what the user sells, in a few words.

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/prospect-battle-card/run.mjs" -o sp-battle-card.mjs
    node sp-battle-card.mjs --domain linear.app --product "an AI QA testing tool for web apps"

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the card.

## Doing it step by step

Only when the script cannot be used. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. Tool `firecrawl.scrape` {"url": "https://<domain>"}; if it fails, `jina.reader` with the same input. This is source S1.
2. Tool `serper.google-search` twice: {"query": "<company> <domain> news"} and {"query": "<company> competitors alternatives"}. Number each result S2, S3...
3. Tool `hunter.domain-search` {"domain": "<domain>", "limit": 10} for names, titles and emails.
4. Ask an LLM (for example `openrouter.openai-gpt-5.4-mini`) for the card from the numbered sources, citing [S#] after every fact. Give it the job titles only, never the names or emails; return a suggested role only, never a list of people or contact details. Drop any [S#] that is not in your list. Google results carry no reliable dates, so do not call news recent.
5. Publish: POST https://superpowers.tools/v1/shares {"title": "Battle card: <company>", "recipe": "prospect-battle-card", "items": [...]}, with a Sources item listing each cited source and its link.

Add up charge_usd from every call and report that total.

## After the run

Give the user the share_url and the talking points. Say that news items come from Google results, so the user should check their dates, and that role suggestions are hypotheses, not verified decision-makers; do not send anything on the user's behalf. Offer next steps: the same card for another prospect, `competitor-ad-watch` for the prospect's ads, or `local-competitor-map` for a local business.
