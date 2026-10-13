---
name: competitor-pricing-table
description: Build a competitor pricing table with Superpowers - for up to four competitors' pricing pages, a browser agent switches the monthly/yearly toggle and returns every plan with the price billed yearly and billed monthly, the yearly saving and three headline features. Use when the user wants to compare competitors' plans and prices, build a pricing battlecard, or check a competitor's current pricing.
---

# Competitor pricing table

A Superpowers recipe. Give it up to four pricing pages. For each one, a browser agent opens the live page, reads every plan with yearly billing, switches the toggle to monthly billing and reads them again, and notes three headline features per plan. The table, and how much yearly billing saves, are put together in code from what the pages show, and every price is checked against the page's own text: a ✓ means the page text shows that price; prices that only appear after the billing toggle, or that the agent misread, are flagged for the user to check. Typical cost: 20 cents per pricing page plus half a cent for the check, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **pages** (required): up to four pricing page links, separated by commas (airtable.com/pricing, clickup.com/pricing).

Ask for anything missing. Mention the cost before the first run.

## Use the script (preferred)

    curl -s "https://superpowers.tools/recipes/competitor-pricing-table/run.mjs" -o sp-pricing.mjs
    node sp-pricing.mjs --pages "airtable.com/pricing, clickup.com/pricing"

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with share_url, charge_usd (the real total; report that number) and the result.

## Doing it step by step

Only when the script cannot be used. For each page, POST https://superpowers.tools/v1/run (or the run_tool MCP tool) with tool tinyfish.web-agent and input {"url": "<pricing page>", "goal": "List every plan on this pricing page. If there is a monthly/yearly billing toggle, read every plan's price with yearly billing, then switch the toggle and read it with monthly billing. Give each price per user per month as a number, or the page's words when there is none. Add the plan's first three headline features. Return JSON."}. Build the table from output.result.plans. Then read the pages' text with tinyfish.fetch ({"urls": [the pages]}) and mark each price the text shows; flag the others. A page that fails costs nothing; say which one.

## After the run

Give the user the share_url and the table. Say the date the pages were read; prices change. Quote the page's own words for plans without a number (Custom, Contact sales). Do not guess a price the page does not show, and tell the user which prices were not in the page text: browser agents sometimes misread a price. Run it again next month with the same pages to see what changed.
