# Prints only the pages of an OCR'd filing that hold the figures we need.
import re, sys, os
text = open(f"{os.environ.get('TEXT', 'text')}/{sys.argv[1]}.txt", encoding="utf-8").read()
pages = re.split(r"^=== PAGE (\d+)\n", text, flags=re.M)
TESTS = {
    "P&L": lambda t: re.search(r"(comprehensive income|profit and loss account|income statement)", t, re.I) and re.search(r"before tax", t, re.I) and re.search(r"turnover|revenue", t, re.I) and len(re.findall(r"\d{1,3},\d{3}", t)) > 8,
    "REVENUE": lambda t: re.search(r"broadcast|television|media|central distribution", t, re.I) and re.search(r"(gate|match ?day|ticket)", t, re.I) and len(re.findall(r"\d{1,3},\d{3}", t)) > 6,
    "STAFF": lambda t: re.search(r"wages and salaries", t, re.I) and re.search(r"social security", t, re.I),
    "OPEX": lambda t: re.search(r"amortisation", t, re.I) and re.search(r"(operating (expenses|costs)|administrative expenses|cost of sales)", t, re.I) and len(re.findall(r"\d{1,3},\d{3}", t)) > 6,
}
for i in range(1, len(pages), 2):
    num, body = pages[i], pages[i + 1]
    hits = [k for k, f in TESTS.items() if f(body)]
    if hits and not re.search(r"(contents|strategic report|directors' report)", body[:200], re.I):
        print(f"\n##### PAGE {num} [{', '.join(hits)}]")
        print(body.strip())
