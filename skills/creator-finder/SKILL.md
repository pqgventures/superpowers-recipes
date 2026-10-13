---
name: creator-finder
description: Find TikTok creators in a niche and country who post about it regularly, ranked by the plays their videos usually get (not followers), with each creator's best recent video, using Superpowers. Use when the user wants creators or influencers for paid posts, UGC or a launch, asks who to pitch in a niche, or wants to know which creators actually reach people.
---

# Creators in your niche, ranked by their usual reach

A Superpowers recipe. Give it one to three search phrases in your customers' language (for example "maquiagem, resenha maquiagem"), optional niche words and a country. It searches TikTok, keeps videos from that country, reads the latest videos of up to 15 creators in your follower range, keeps those whose latest videos are mostly about your niche, and ranks them by usual reach: the median plays of their latest videos, which is what a paid post most likely gets. Each creator comes with followers, how many of their latest videos are about your niche, their best recent video and any recent paid partnerships. Measured cost on 2026-10-11: about $0.16 a run (16 calls), about 40 seconds. Charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **phrases** (required): 1 to 3 phrases, comma separated. TikTok search is not limited to one country, so use words only your customers' language uses ("maquiagem", not "makeup"; "barista" returns mostly Spanish-speaking creators).
- **niche_words** (optional): words that show a video is about the niche, comma separated. Empty uses the words of the phrases.
- **country** (optional): two letters, default BR.
- **period** (optional): this-week, this-month (default) or last-3-months.
- **followers** (optional): range like 2000-1500000.
- **creators** (optional): 3 to 15 creators to read in depth, default 12 (one call each).

## Run it: let Superpowers do it

    curl -s -m 30 -X POST "https://superpowers.tools/v1/recipes/creator-finder/run" \
      -H "Authorization: Bearer $SUPERPOWERS_API_KEY" -H "Content-Type: application/json" \
      -d '{"inputs": {"phrases": "maquiagem, resenha maquiagem", "niche_words": "maquiagem, make, batom, base, corretivo, pele", "country": "BR"}, "idempotency_key": "creator-finder-20261011-0700"}' > result.json

The run takes about a minute. Each request returns within about 30 seconds with either the result or {"status": "running", "idempotency_key": "...", "retry_after_s": 20}. Send the identical request again with that idempotency_key every 20 seconds until it stops answering running; you are charged once. Make the key unique for each new run (letters, digits and - _ . : / only). If the answer is 402, the balance is too low: tell the user and stop. With MCP, call run_recipe with {"recipe": "creator-finder", "inputs": {...}, "idempotency_key": "..."}.

Run it once: if a request times out, resend it with the same idempotency_key; never pick a new key for the same search, never download or run a script for this recipe, and never mix in manual searches. Keep the API key in the SUPERPOWERS_API_KEY environment variable; never write it into a file.

The finished answer has share_id, share_url, charge_usd and steps. The steps are raw tool data and include creators the recipe set aside; do not build your answer from them. Read the result with GET https://superpowers.tools/v1/shares/<share_id> (same Authorization header): its items are the summary, the creators kept, their best videos and how to use it.

## Doing it step by step

Only when the request above answers an error other than running or 402 (for example 404 or 500), and never in addition to it. If you get here, usual reach must still come from each creator's latest videos (tiktok-profile-videos), never from the search results. Each call is POST https://superpowers.tools/v1/run with {"tool": "<tool>", "input": {...}, "idempotency_key": "<unique for that call>"}; report the sum of charge_usd of every call.

1. Search: `scrapecreators.tiktok-search` with {"query": "<phrase>", "period": "this-month", "sort": "most-liked"} for each phrase, and once more with "cursor" set to next_cursor. Keep videos whose region is the country.
2. Candidates: group those videos by author, keep authors whose author_followers is in the range, most played first, up to 12.
3. Creator: `scrapecreators.tiktok-profile-videos` with {"handle": "<author>", "region": "<country>", "sort": "latest"}. Count how many of the latest 12 captions contain a niche word; compute the median plays of those videos without the one you found.
4. Keep creators with at least half of their latest videos about the niche; sort by that median.
5. Publish: POST https://superpowers.tools/v1/shares {"title": "TikTok creators in <country> who post about <phrase>", "recipe": "creator-finder", "items": [a short summary, then one item per creator: {"label": "@handle", "url": "<profile link>", "caption": "<followers · N of M latest videos about the niche · usual reach · best recent video plays>"}, then one item per best video with its link]}.

## After the run

Give the user the share_url and the ranked creators exactly as the share's items list them, leading with usual reach. Report only those creators, with their numbers as written, and add nothing the items do not say (no job titles, no niches you guessed from a handle). Usual reach comes from the creator's latest videos; never report the plays of the video you found in search as a creator's usual or typical reach. If usual reach is a few thousand plays, say so: that creator had one lucky video. Explain that usual reach is the median of their latest videos and that a breakout video is luck, not what a paid post gets. Counts are what TikTok reports at the time of the run, and the profile feed may miss some posts. Do not copy emails or phone numbers from bios into your answer; send the user to each profile. Suggest running it again before each campaign.

