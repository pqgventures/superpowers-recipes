---
name: competitor-google-ads
description: See the Google ads your competitors run with Superpowers - for up to four competitor websites, how many ads Google reports in the last 7 or 30 days, the formats, which ads started recently and which they have kept live longest, each linked to Google's public Ads Transparency Center. Use when the user wants to check or monitor competitors' Google, YouTube or Shopping ads.
---

# Competitor Google ads

A Superpowers recipe. Give it up to four competitor websites. For each one it reads Google's public Ads Transparency Center: how many ads Google reports in the window, the formats of the ads it lists first (text, image, video), which of those started inside the window, and the ones that have run longest (an ad a brand keeps paying for is usually one that works for them). Every number is counted in code; nothing is guessed. Typical cost: about 1 cent per competitor, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **competitors** (required): up to four websites, separated by commas (allbirds.com, glossier.com).
- **days** (optional, default 30): 7 or 30.
- **country** (optional, default US): two-letter country code.

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/competitor-google-ads/run.mjs" -o sp-google-ads.mjs
    node sp-google-ads.mjs --competitors "allbirds.com, glossier.com" --days 30 --country US

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the result.

## Doing it step by step

Only when the script cannot be used. For each website, POST https://superpowers.tools/v1/run (or the run_tool MCP tool) with tool searchapi.google-ads and input {"domain": "<website>", "region": "<country>", "time_period": "last_30_days", "num": 24} (use "last_7_days" for a 7-day window). Then, from the ads it returns:

1. total_results is Google's own estimate of ads shown in the window; say "about".
2. Count the formats of the returned ads (text, image, video).
3. Ads with first_shown inside the window started recently; list them newest first.
4. Sort by days_shown: the top ones are the ads they have kept live longest.
5. Any ad whose advertiser name does not carry the brand was paid for by someone else (a reseller or a look-alike): list it with the advertiser name. Run it on the user's own site to catch these.
6. Link every ad with its details_link; show image_url previews when present (some image ads only show Google's placeholder).

## After the run

Give the user the share_url and the summary. Say plainly that counts are Google's estimate at that moment and the lists come from the first 24 ads Google shows per brand. Do not claim spend, reach or results; the data has dates and formats, not performance. Run it again next week with the same websites to see what changed.
