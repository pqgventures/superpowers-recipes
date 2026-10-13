---
name: competitor-ad-teardown
description: Pull competitors' live Facebook and Instagram ads from the Meta Ad Library with Superpowers and write a teardown brief with cited ads, repeating hooks, longest-running ads, offers, white space and three ad concepts. Use when the user wants to see what competitors are advertising, spy on competitor ads, or get ad ideas based on the competition.
---

# Competitor ad teardown

A Superpowers recipe. Give it up to four competitor brand names and what you sell; it finds each brand's page in the Meta Ad Library, pulls the ads they are running now (copy, format, call to action, landing page, start date), and writes a brief: what each competitor is doing, the hooks that repeat, the longest-running ads, offers and retail moves, gaps in the sampled ads, and three ad concepts for you. Every ad in the brief links to the Ad Library. Typical cost: about $0.10 for two competitors (recorded run: $0.094983), charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **competitors** (required): up to four brand names, separated by commas.
- **product** (required): what the user sells, in a few words.
- **country** (optional, default US): two-letter code where the ads run, or ALL.

Ask the user for competitors and product if they are not clear. Mention the cost before the first run.

## Fastest way: run the script

    curl -s "https://superpowers.tools/recipes/competitor-ad-teardown/run.mjs" -o sp-ad-teardown.mjs
    node sp-ad-teardown.mjs --competitors "Liquid Death, Poppi" --product "a new prebiotic sparkling soda" --country US

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd and each step's output. Bun works too.

## Doing it step by step

With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. For each competitor: tool `scrapecreators.meta-ad-advertisers`, input {"query": "<brand>"}. Keep only advertisers whose name starts with the brand (ignoring case and punctuation); prefer an exact match, skip personal pages (blogs, public figures, pets), then the most likes. If nothing matches, tell the user and ask for the right spelling instead of using another page.
2. For each page: tool `scrapecreators.meta-company-ads`, input {"page_id": "<page_id>", "country": "US"}. Returns up to the 30 ads Meta shows first and `total`; pass `next_cursor` back as `cursor` for more.
3. Write the brief with an LLM (for example `openrouter.anthropic-claude-sonnet-5`, input {"prompt": ..., "max_tokens": 3000}). Give it only the ads' page_name, library_url, start_date, days_running, platforms, format, variants, title, body, cta and landing_domain, and tell it to cite every ad as a link with its start date and to invent nothing. Compute theme counts across all languages before writing: normalize accents, count “prebiotic” and “prebióticos” together, and never count one ad twice. Say “the 30 ads Meta shows first”; scope absences to that sample.
4. Check the brief before showing it: every ad id it links must appear in the data you passed, with the same dates. Fix or remove anything that does not.
5. Publish the result: POST https://superpowers.tools/v1/shares {"title": "Competitor ad teardown: <brands>", "recipe": "competitor-ad-teardown", "items": [{"label": "Brief", "text": "<brief>"}, {"label": "Longest-running ads", "text": "<one line per ad with its link>"}]}. Keep `"recipe": "competitor-ad-teardown"` so the link counts for this recipe.

## After the run

Give the user the share_url with the brief. Say which Ad Library page each brand matched. A brand with 0 ads in one country may advertise elsewhere: offer to rerun with country ALL. Remind the user that days running measures duration, not performance (the Ad Library shows no spend or results) and that a brand with no active ads may be advertising elsewhere. Offer next steps: more pages of ads with the cursor, the same teardown for another country, or the `ad-concepts` recipe to turn a concept into visuals.
