---
name: competitor-ad-watch
description: Watch competitors' Facebook and Instagram ads with Superpowers: which ads each competitor started and stopped in the last 7, 14 or 30 days, the ads Meta shows most, and a short note on what changed, with every ad linked to the Meta Ad Library. Use when the user wants to monitor or track competitors' ads, see what a competitor just launched, or get a weekly competitor ad report.
---

# Competitor ad watch

A Superpowers recipe. Give it up to four competitor brands. For each one it finds the brand's Meta Ad Library page, counts the ads running now, lists the ads that started in the window (newest first) and the ads that stopped in it, picks the ads Meta shows most, and writes a short note per brand on what changed. Counts come from the Ad Library dates, computed in code; every ad links to the Ad Library. Typical cost: about $0.12 for two brands (more for brands that launched many ads), charged to the user's Superpowers balance. Run it every week with the same brands.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **competitors** (required): up to four brand names, separated by commas.
- **days** (optional, default 14): 7, 14 or 30.
- **country** (optional, default US): two-letter code, or ALL.

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/competitor-ad-watch/run.mjs" -o sp-ad-watch.mjs
    node sp-ad-watch.mjs --competitors "Liquid Death, Poppi" --days 14 --country US

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the result.

## Doing it step by step

Only when the script cannot be used. With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. Tool `scrapecreators.meta-ad-advertisers` {"query": "<brand>"}. Keep pages whose name starts with the brand; prefer an exact name, put personal pages (blogs, public figures, creators) last, then most likes. If a page has no ads, try the next one.
2. Tool `scrapecreators.meta-company-ads` {"page_id": "...", "country": "US", "sort": "impressions"}: total ads running and the ads Meta shows most.
3. Same tool with "sort": "recent" (newest first); pass next_cursor as cursor until the ads start before the window (at most 4 pages). Ads whose start_date is inside the window started in it.
4. Same tool with "status": "INACTIVE", "sort": "recent": ads whose end_date is inside the window stopped in it.
5. Count in code. Ask an LLM (for example `openrouter.openai-gpt-5.4-mini`) for one short note per brand, giving it ads by short refs (A1, A2...) and telling it to cite only refs; replace refs with the ads' library_url in code. Never let the model copy ad ids or compute counts.
6. Publish: POST https://superpowers.tools/v1/shares {"title": "Competitor ad watch: <brands>", "recipe": "competitor-ad-watch", "items": [...]}.

Add up charge_usd from every call and report that total.

## After the run

Give the user the share_url and the table of started and stopped ads. Say that the Ad Library shows no spend or results, so a burst of new ads is a signal of activity, not of success; that a brand with no ads in one country may advertise elsewhere (offer country ALL); and that a count marked + means there were more new ads than the four pages read. Offer next steps: run it again next week, `competitor-ad-teardown` for a full analysis of one brand's ads, or `ad-concepts` to answer a competitor's new angle.
