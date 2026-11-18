import re, sys, html, urllib.request, urllib.parse
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
for q in sys.argv[1:]:
    s = get("https://find-and-update.company-information.service.gov.uk/search/companies?q=" + urllib.parse.quote(q))
    items = re.findall(r'href="/company/([0-9A-Z]+)"[^>]*>(.*?)</a>.*?<p class="meta crumbtrail">(.*?)</p>', s, re.S)
    print("##", q)
    for num, name, meta in items[:5]:
        clean = lambda t: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()
        print("  ", num, "|", clean(name), "|", clean(meta)[:70])
