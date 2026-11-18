# For each club: find the latest annual accounts (AA) filing and download the PDF.
import re, sys, html, json, os, urllib.request
BASE = "https://find-and-update.company-information.service.gov.uk"
def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = urllib.request.urlopen(req, timeout=60).read()
    return data if binary else data.decode("utf-8", "replace")
clean = lambda t: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()
os.makedirs("pdf", exist_ok=True)
meta = json.load(open("filings.json")) if os.path.exists("filings.json") else {}
only = set(sys.argv[1:])
for line in open("clubs.tsv", encoding="utf-8"):
    slug, name, number = line.rstrip("\n").split("\t")
    if only and slug not in only:
        continue
    page = get(f"{BASE}/company/{number}/filing-history?category=accounts")
    company = clean(re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S).group(1))
    found = None
    for row in re.findall(r"<tr>(.*?)</tr>", page, re.S):
        cells = [clean(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        link = re.search(r'href="([^"]*/document\?format=pdf)', row)
        if len(cells) >= 3 and cells[1] == "AA" and link and "2025" in cells[2] and "dormant" not in cells[2]:
            found = {"filed": cells[0], "description": cells[2], "url": BASE + html.unescape(link.group(1))}
            break
    meta[slug] = {"name": name, "companyNumber": number, "companyName": company, **(found or {})}
    if found:
        with open(f"pdf/{slug}.pdf", "wb") as f:
            f.write(get(found["url"] + "&download=1", binary=True))
    print(slug, "|", company, "|", found and found["filed"], "|", found and found["description"], flush=True)
json.dump(meta, open("filings.json", "w"), indent=2)
