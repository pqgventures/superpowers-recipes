---
name: public-contract-winners
description: List the Brazilian companies that won a government contract for a given kind of work in the last days (who, how much, which agency, where, with each company's city and main activity), from Brazil's public-procurement portal PNCP, with Superpowers. Use when the user sells to companies in Brazil and wants warm leads (firms that just got work and money and now need suppliers, equipment, staff, insurance or credit), or asks who is winning public contracts in a sector.
---

# Companies that just won a public contract in your field

A Superpowers recipe. Give it the kind of work, in Portuguese (for example pavimentação, merenda escolar, suporte de TI). It reads the newest contracts on PNCP, keeps those published in the last days, leaves out individuals, MEIs and firms registered to a person, groups the rest by company, sorts them by contracted value and adds each company's city, main activity and registry status. Measured cost on 2026-10-10: about $0.005 a run, about 5 seconds. Charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **work** (required): what the winners were hired to do, in the words agencies use in contracts.
- **states** (optional): two-letter states, comma separated (PR, SC, RS). Empty means all of Brazil.
- **days** (optional): 1 to 30, default 7.
- **companies** (optional): 1 to 15, default 10.

## Fastest way: run the script

    curl -s "https://superpowers.tools/recipes/public-contract-winners/run.mjs" -o sp-contract-winners.mjs
    node sp-contract-winners.mjs --work "pavimentação" --states "PR, SC" > result.json

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints one JSON object (status, share_url, charge_usd, result). Save it to a file as above, then read share_url and charge_usd from that file and report only this run.

## Doing it step by step

Only when you cannot run Node or Bun. Report the total charge as the sum of charge_usd from every call.

1. Contracts: `pncp.search` with {"query": "<work>", "type": "contract", "sort": "newest", "limit": 50, "page": 1} and page 2 (add "states" if given). Keep contracts not cancelled whose published_at is inside the window.
2. Keep suppliers with a 14-digit CNPJ whose name is not a person's (no MEI number before the name); group by CNPJ and add up contract_value.
3. Company: `brasilapi.cnpj` with {"cnpj": "<14 digits>"} for the largest ones; skip a firm with no partners and no company word in its name (it is registered to a person).
4. Publish: POST https://superpowers.tools/v1/shares {"title": "Won a public contract for "<work>" since <date>", "recipe": "public-contract-winners", "items": [one item per company: {"label": "<company>", "url": "<PNCP contract link>", "caption": "<value · agency · date · company city and activity · contract subject>"}]}.

## After the run

Give the user the share_url, the count and total value, and the top companies. Remind them that PNCP matches words loosely (read each contract's subject), that values are the contract amounts the agencies published, and that the list leaves out people. Do not add contact details; if the user wants to reach a company, they can look it up by its CNPJ. Suggest running it again next week.

