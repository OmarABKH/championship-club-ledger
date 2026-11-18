# record.py slug league units '{"revenue":..}' — stores one club's figures (converted to £'000)
# and checks that the revenue lines add up and that the bridge reconciles to pre-tax.
import json, sys, os
slug, league, units, raw = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
k = 1000 if units == "pounds" else 1
conv = lambda v: round(v / k) if isinstance(v, (int, float)) else v
fig = {key: (conv(v) if not isinstance(v, dict) or key == "pages" else {kk: conv(vv) for kk, vv in v.items()}) for key, v in raw.items()}
fig["league2425"] = league
mix = fig["matchday"] + fig["broadcasting"] + fig["commercial"]
assert abs(mix - fig["revenue"]) <= 2, f"revenue lines {mix} != total {fig['revenue']}"
if "check" in fig:  # optional: other operating income + net interest etc., to prove the bridge
    bridge = fig["revenue"] - fig["staffCosts"] - fig["amortisation"] - fig["otherOpCosts"] + fig["playerSales"] + fig["check"]
    assert abs(bridge - fig["preTax"]) <= 3, f"bridge {bridge} != pre-tax {fig['preTax']}"
    del fig["check"]
data = json.load(open("figures.json")) if os.path.exists("figures.json") else {}
data[slug] = fig
json.dump(data, open("figures.json", "w"), indent=1)
print(f"ok {slug}: revenue {fig['revenue']}, wages/revenue {fig['staffCosts']/fig['revenue']:.0%}, pre-tax {fig['preTax']}  ({len(data)} recorded)")
