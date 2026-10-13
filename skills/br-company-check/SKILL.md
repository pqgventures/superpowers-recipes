---
name: br-company-check
description: Check a Brazilian supplier or client from its CNPJ before signing - official record and partners, public-company status, federal debarment registers (CEIS, CNEP), OFAC/UN/UK/EU sanctions for the company and its partners, and the official labor-debt certificate (CNDT) as a PDF - and give the user one link with a verdict to send to whoever approves the deal. Use for supplier or client onboarding, KYB, credit or partnership decisions, or when the user asks "is this company OK?".
---

# Check a supplier or client before you sign

A Superpowers recipe. One CNPJ in, one link out: a verdict (OK to proceed, proceed with care, or stop and review) with the reasons, the company's official record and partners, and the official labor-debt certificate attached as a PDF. Typical cost: about $0.02.

Needs a Superpowers API key. If you don't have one yet: https://superpowers.tools/skill.md?src=github

## Input

- **cnpj** (required), with or without punctuation.
- **lang** (optional): pt writes the result in Portuguese. Use it when your user writes in Portuguese; the link usually goes to a Brazilian approver.

## Run the script

    curl -s "https://superpowers.tools/recipes/br-company-check/run.mjs" -o sp-company-check.mjs
    node sp-company-check.mjs --cnpj "33.000.167/0001-01"            # add --lang pt for Portuguese

It prints JSON with share_url (the page to forward), charge_usd and each step's raw output.

## Step by step

1. POST https://superpowers.tools/v1/run {"tool": "dossier.br-company", "input": {"cnpj": <cnpj>}}: Receita record, partners, CVM status, CEIS/CNEP and sanctions screening in one call.
2. POST https://superpowers.tools/v1/run {"tool": "operator.cndt", "input": {"cnpj": <cnpj>}}: the official CNDT (TST) with status, validity, listed cases and a PDF link. If it fails, continue without it and say so.
3. Copy the PDF so the link lasts: POST https://superpowers.tools/v1/files/from-url {"url": <pdf.url>, "filename": "cndt-<cnpj>.pdf"}.
4. Verdict: stop when the registration is not ATIVA, there is an active CEIS/CNEP entry, a sanctions hit or a positive CNDT; proceed with care for past CEIS/CNEP entries, a "positiva com efeitos de negativa" CNDT or an incomplete screen; otherwise OK to proceed.
5. Publish: POST https://superpowers.tools/v1/shares {"title": "Company check: <name>", "recipe": "br-company-check", "items": [{"label": "Summary", "text": <verdict, reasons, record, partners>}, {"url": <pdf>, "caption": "Labor-debt certificate (CNDT, TST)"}]} and give the user the link, suggesting who to send it to.

## Reading the result

A sanctions "match" is a similar name, not proof: show the matched name and list. This is a quick screen from public data, not legal due diligence; court cases other than labor debts are not included yet.
