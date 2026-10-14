# Superpowers recipes: ready-made skills for AI agents

**Superpowers** ([superpowers.tools](https://superpowers.tools)) is the pay-per-call toolbox for AI agents: one key and one MCP server for business data, search, scraping, media and AI models, and you pay only when a call works.

This repository holds 29 recipes. Each one is an agent skill (`SKILL.md`) plus a script (`run.mjs`) that does one real job end to end: check a Brazilian supplier from its CNPJ, see every ad your competitors launched this fortnight, turn App Store reviews into a testimonial video. Claude Code, Codex, Cursor or any agent that reads skills can follow them, and the script runs with Node 18+.

> Not to be confused with [obra/superpowers](https://github.com/obra/superpowers), the skills library for coding agents. This is the hosted tools marketplace by PQG Ventures.

## Use a recipe

1. Get a key at [superpowers.tools/login](https://superpowers.tools/login). New accounts get US$5 of credit, failed calls are free, and an agent can sign up by itself with `POST https://superpowers.tools/v1/signup`.
2. Save it: `export SUPERPOWERS_API_KEY=...` (or put it in `~/.config/superpowers/key`).
3. Either give the skill to your agent, or run the script yourself:

```sh
node skills/br-company-check/run.mjs --cnpj "33.000.167/0001-01"
```

To install a skill, copy its folder into `~/.claude/skills/` (Claude Code) or `~/.codex/skills/` (Codex). In Claude Code you can also add the whole set as a plugin:

```
/plugin marketplace add pqgventures/superpowers-recipes
/plugin install superpowers-recipes@superpowers-recipes
```

Every recipe calls the same Superpowers API, so one key covers all of them. To connect the MCP server instead, see [pqgventures/superpowers-mcp](https://github.com/pqgventures/superpowers-mcp).

## Recipes

Costs are what a typical run charged. Each "example" link shows a real run with its output.

### Brazil and compliance

| Recipe | Typical cost | Real run |
|---|---|---|
| [Check a supplier or client before you sign](skills/br-company-check/SKILL.md) | $0.02 | [example](https://superpowers.tools/recipes/br-company-check) |
| [Companies that just won a public contract in your field](skills/public-contract-winners/SKILL.md) | under $0.01 | [example](https://superpowers.tools/use-cases/public-contract-winners) |

### Competitors and ads

| Recipe | Typical cost | Real run |
|---|---|---|
| [Competitor ad watch](skills/competitor-ad-watch/SKILL.md) | $0.12 | [example](https://superpowers.tools/use-cases/competitor-ad-watch) |
| [Competitor ad teardown](skills/competitor-ad-teardown/SKILL.md) | $0.10 | [example](https://superpowers.tools/use-cases/competitor-ad-teardown) |
| [Competitor Google ads](skills/competitor-google-ads/SKILL.md) | $0.03 | [example](https://superpowers.tools/use-cases/competitor-google-ads) |
| [Competitor email offer watch](skills/competitor-email-offer-watch/SKILL.md) | $0.03 | [example](https://superpowers.tools/use-cases/competitor-email-offer-watch) |
| [Competitor pricing table](skills/competitor-pricing-table/SKILL.md) | $0.62 | [example](https://superpowers.tools/use-cases/competitor-pricing-table) |
| [Local competitor map](skills/local-competitor-map/SKILL.md) | $0.05 | [example](https://superpowers.tools/use-cases/local-competitor-map) |
| [How your store looks abroad](skills/store-abroad-check/SKILL.md) | $0.12 | [example](https://superpowers.tools/use-cases/store-abroad-check) |
| [Weekly review of your ads from the export](skills/weekly-ads-review/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/weekly-ads-review) |
| [SEO and AI-search report for your website](skills/seo-geo-report/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/seo-geo-report) |

### Make ads and video

| Recipe | Typical cost | Real run |
|---|---|---|
| [Three ad concepts to choose from](skills/ad-concepts/SKILL.md) | $0.17 | [example](https://superpowers.tools/recipes/ad-concepts) |
| [30-second spoken pitch](skills/spoken-pitch/SKILL.md) | $0.01 | [example](https://superpowers.tools/recipes/spoken-pitch) |
| [Testimonial ad video from App Store reviews](skills/testimonial-ad-video/SKILL.md) | $0.09 | [example](https://superpowers.tools/use-cases/testimonial-ad-from-app-store-reviews) |
| [Video ad from a one-line brief](skills/seedance-video-ad/SKILL.md) | $0.40 | [example](https://superpowers.tools/use-cases/video-ad-from-a-one-line-brief) |
| [Video ad from your product page](skills/product-video-ad/SKILL.md) | $0.25 | [example](https://superpowers.tools/use-cases/product-video-ad) |
| [Trend to ads](skills/trend-to-ads/SKILL.md) | $0.15 | [example](https://superpowers.tools/use-cases/trend-to-ads) |
| [Find creators in your niche, ranked by their usual reach](skills/creator-finder/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/creator-finder) |

### Sales and leads

| Recipe | Typical cost | Real run |
|---|---|---|
| [Prospect battle card](skills/prospect-battle-card/SKILL.md) | $0.06 | [example](https://superpowers.tools/use-cases/prospect-battle-card) |
| [Opening lines from each company's latest news](skills/lead-openers/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/lead-openers) |
| [Verified emails for a team at your target companies](skills/verified-lead-list/SKILL.md) | $0.82 | [example](https://superpowers.tools/use-cases/marketing-emails-at-target-companies) |
| [Which of your target accounts just raised money](skills/funding-signals-watch/SKILL.md) | $1.60 | [example](https://superpowers.tools/use-cases/funding-signals-watch) |
| [Founders of startups that just raised](skills/just-raised-founders/SKILL.md) | $0.20 | [example](https://superpowers.tools/use-cases/just-raised-founders) |
| [Private company profile from a website](skills/private-company-profile/SKILL.md) | $0.28 | [example](https://superpowers.tools/use-cases/private-company-profile-from-a-website) |

### Research

| Recipe | Typical cost | Real run |
|---|---|---|
| [What buyers complain about, from Reddit](skills/buyer-voice-research/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/buyer-voice-research) |
| [This week's stories in your niche, ready for your newsletter](skills/niche-weekly-digest/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/niche-weekly-digest) |
| [Find a paper, verify its DOI, classify its title](skills/sourced-research-check/SKILL.md) | per the example | [example](https://superpowers.tools/recipes/sourced-research-check) |

### More

| Recipe | Typical cost | Real run |
|---|---|---|
| [Who ranks for your keyword](skills/serp-competitor-snapshot/SKILL.md) | under $0.01 | [example](https://superpowers.tools/recipes/serp-competitor-snapshot) |
| [Find local leads with phone numbers](skills/local-leads/SKILL.md) | under $0.01; about $0.05 more per business with emails | [example](https://superpowers.tools/recipes/local-leads) |

## How recipes are kept honest

Each recipe is run for real through the Superpowers gateway before it is listed, and the page linked as "example" shows that run's output, date and cost. The copies here are exported from [superpowers.tools/recipes](https://superpowers.tools/recipes), the source of truth; if a step changes, the site has it first.

## License

MIT.

