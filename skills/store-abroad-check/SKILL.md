---
name: store-abroad-check
description: See how a store or product page looks to shoppers in other countries with Superpowers - one real-browser screenshot per country from a home connection there (up to five), side by side, with the status the site answered. Use when the user sells abroad or watches a competitor that does and wants to check popups, currency, shipping banners, store pickers, cookie notices, redirects or blocked pages per country.
---

# How your store looks abroad

A Superpowers recipe. Give it a page and up to five countries. For each country, a real browser loads the page through a home internet connection in that country and takes a screenshot of what a shopper there sees, with the status the site answered. You compare the screenshots and tell the user what differs. Typical cost: 3 cents per country, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **url** (required): a product, collection or home page.
- **countries** (default us, gb, de, jp): up to five two-letter codes, separated by commas.
- **full_page** (default no): yes to capture the whole page instead of the first screen.

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/store-abroad-check/run.mjs" -o sp-abroad.mjs
    node sp-abroad.mjs --url "https://www.allbirds.com/products/mens-tree-runners" --countries "us, gb, de, jp"

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the result, including one screenshot link per country.

## Doing it step by step

Only when the script cannot be used. For each country, POST https://superpowers.tools/v1/run (or the run_tool MCP tool) with tool mrscraper.geo-screenshot and input {"url": "<page>", "country": "<code>", "full_page": false}. Each result has image_url and status_code. A country that fails costs nothing.

## After the run

Open every screenshot yourself and compare them: popups (email sign-up, discounts), the currency and price shown, shipping banners and store pickers, cookie notices, a different language, redirects, and blank or blocked pages. Give the user the share_url, a short list of what differs by country, and what to fix first. Say the date; sites change their banners often.
