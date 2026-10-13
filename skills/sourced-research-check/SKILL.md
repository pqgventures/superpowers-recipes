---
name: sourced-research-check
description: Find a scholarly paper on a topic with Superpowers, confirm its DOI resolves to the same record, and run the title through text moderation. Use when the user needs a citable source for a topic and wants the DOI checked. Free.
---

# Find a paper, verify its DOI, classify its title

A Superpowers recipe using three free tools. Moderation only classifies the title for content review; it is not fact checking.

Needs a Superpowers API key. If you don't have one yet: https://superpowers.tools/skill.md?src=github

## Run the script

    curl -s "https://superpowers.tools/recipes/sourced-research-check/run.mjs" -o sp-research-check.mjs
    node sp-research-check.mjs --query "graph neural networks"

## Step by step

1. POST https://superpowers.tools/v1/run {"tool": "crossref.search-works", "input": {"query": <topic>, "limit": 2}} and take results[0].doi.
2. POST https://superpowers.tools/v1/run {"tool": "crossref.lookup-doi", "input": {"doi": <doi>}} and check the returned doi matches.
3. POST https://superpowers.tools/v1/run {"tool": "openai.moderate-text", "input": {"text": <title>}}.

Report the title, the https://doi.org/ link and whether the DOI matched. Try the next search result if the user wants a different paper.
