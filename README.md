# Championship Club Ledger

What each of the 24 clubs in the 2026/27 EFL Championship earned, spent on wages and lost, taken from their latest annual accounts at Companies House (mostly the 2024/25 season).

- **Headline numbers:** how many clubs spent more on staff than they earned, plus combined revenue and losses
- **Wages as a share of revenue**, with the 100% line marked
- **Where the money comes from:** matchday, broadcasting, commercial & other (in £m or as % of revenue)
- **Profit or loss before tax**, including player sales
- **A full sortable table**, plus a page for each club with a step-by-step breakdown from revenue to profit or loss and a link to the exact pages in the original filing

## Running it

Open `index.html` in a browser. No build step and no dependencies.

## Where the numbers come from

The pipeline in [pipeline/](pipeline/) turns filings into checked figures:

1. **`fetch.py`** finds each club's company on Companies House (from `clubs.tsv`) and downloads the latest full accounts covering 2024/25.
2. **`ocr.swift`**: the filings are scanned images, so each page is run through macOS's built-in text recognition (Vision), rebuilding table rows from where the text sits on the page.
3. **`keypages.py`** pulls out the pages that matter: income statement, revenue note and staff costs note.
4. **`record.py`** stores one club's figures and **refuses them unless they check out**:
   - the revenue lines must add up to total revenue;
   - revenue − staff costs − other costs − amortisation + player sales + other items must equal the reported result before tax.
   Where the OCR text is garbled (sideways pages, blank tables), the figures are read from a rendered image of the page (`render.swift`) and still pass the same checks.
5. **`build_data.py`** combines everything into `data/clubs.js`, which the site loads.

To refresh next season: update `clubs.tsv`, run `python3 fetch.py`, OCR the PDFs (`swiftc -O ocr.swift -o ocr`, then `./ocr pdf/<club>.pdf > text/<club>.txt`), record each club with `record.py`, then run `build_data.py`. Downloaded PDFs and OCR text are not stored in the repository.

### Judgement calls

- **Which company:** the club's main operating company, except where the full picture is only in a parent's group accounts (QPR Holdings, Football Ventures (Whites) for Bolton, Norwich City Football Club PLC). Each club's page names the company used.
- **Revenue categories:** clubs label revenue differently. Their lines are mapped to matchday, broadcasting and commercial & other; anything ambiguous goes into commercial & other, and individual calls are noted on the club's page.
- **Staff costs** include wages, social security and pensions, as reported in each staff costs note.
- **Different periods:** most years end on 30 June; Cardiff, QPR, Stoke and West Ham use 31 May, Burnley 31 July. Wolves' accounts cover 13 months.
- **Not a PSR calculation:** allowable deductions (academy, women's football, community, infrastructure) aren't fully disclosed, so the site doesn't estimate whether clubs are within the EFL's spending limits.

## Files

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/` | The site (plain HTML/CSS/JS, SVG charts drawn by hand in `js/charts.js`) |
| `data/clubs.js` | Generated data: all figures in £'000 as reported |
| `pipeline/` | Scripts and the checked source data (`filings.json`, `figures.json`) |
