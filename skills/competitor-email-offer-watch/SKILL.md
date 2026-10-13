---
name: competitor-email-offer-watch
description: Watch competitors' marketing emails with Superpowers. Creates a private receive-only email address per competitor to sign up to their newsletters, then reads what they send and writes a brief of each welcome offer, discount, hook, call to action and link. Use when the user wants to see competitors' email offers, newsletters, discounts or promotions, or monitor competitor email marketing.
---

# Competitor email offer watch

A Superpowers recipe in two runs. The first run gives the user one private email address per competitor (up to five). They, or you if you have a browser, sign up to each competitor's newsletter with it. The second run, minutes or days later, reads everything that arrived and writes a brief: for each competitor the sender, date and exact subject, the offer and its terms (discount codes included), the hook, the call to action and links copied from the email, then three patterns worth copying and one gap to exploit. Typical cost: about $0.03 for the first run with three competitors and $0.03 to $0.05 for a brief, charged to the user's Superpowers balance.

Needs a Superpowers API key. If you don't have one yet, set it up first: https://superpowers.tools/skill.md?ref=

## Inputs

- **competitors** (first run): up to five brand names, separated by commas.
- **watch** (later runs): the `watch` value the first run returned. Keep it: it holds each address and its access token, the only way to read that mail.

Ask the user for competitors if they are not clear. Mention the cost before the first run.

## Fastest way: run the script

    curl -s "https://superpowers.tools/recipes/competitor-email-offer-watch/run.mjs" -o sp-email-watch.mjs
    node sp-email-watch.mjs --competitors "Olipop, Poppi, Zevia"

Sign up with each printed address on the competitor's site. Then:

    node sp-email-watch.mjs --watch "<the watch value from the first run>"

It reads the key from SUPERPOWERS_API_KEY or ~/.config/superpowers/key and prints JSON with each step's output and charge_usd. Bun works too.

## Doing it step by step

With POST https://superpowers.tools/v1/run (or the run_tool MCP tool):

1. For each competitor: `agentmail.create-address` with `{"label": "<brand, lowercase letters/digits>"}`. Keep `address` and `access_token` together.
2. Sign up to each competitor's newsletter with its address: the footer or pop-up form on their homepage. If an email asks to confirm the subscription, open its confirmation link (find it with step 4).
3. Wait. Welcome emails usually arrive within minutes.
4. For each address: `agentmail.list-messages` with `{"address", "access_token", "limit": 5}`, then `agentmail.get-message` with the same address, token and each `message_id`. You get `subject`, `from`, `text`, `links` and `codes`.
5. Write the brief from that text only, or send it to an LLM tool such as `openrouter.openai-gpt-5.4-mini` with `{"prompt": ..., "max_tokens": 1500}`. Quote subjects and offers exactly; never invent an offer.

## Notes

- The addresses only receive mail; they cannot send.
- Many brands put their offer in images. When the text has no offer, say so, and check the links: discount codes often sit in a link (`?discount=CODE`).
- Sign up only to newsletters the user would sign up to themselves, and don't use the addresses to create accounts on other people's behalf.
