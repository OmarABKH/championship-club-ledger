// Builds the page from data/clubs.js. All money figures in the data are £'000, as reported.
(function () {
  "use strict";

  const { barChart } = window.Charts;
  const DATA = window.CLUB_DATA;

  const LEAGUES = { PL: "Premier League", CH: "Championship", L1: "League One" };
  const LEAGUE_SHORT = { PL: "PL", CH: "Champ", L1: "L1" };
  const STREAMS = {
    matchday: { label: "Matchday", color: "var(--series-1)" },
    broadcasting: { label: "Broadcasting", color: "var(--series-2)" },
    commercial: { label: "Commercial & other", color: "var(--series-3)" },
  };

  // ---------- Derived figures ----------

  const clubs = DATA.clubs.map((c) => {
    const operating = c.revenue - c.staffCosts - c.amortisation - c.otherOpCosts + c.playerSales;
    return {
      ...c,
      wageRatio: c.staffCosts / c.revenue,
      revenueChange: c.prior && c.prior.revenue ? c.revenue / c.prior.revenue - 1 : null,
      otherItems: c.preTax - operating, // other income, interest and one-offs: the balancing figure
    };
  });

  // ---------- Formatting ----------

  const m = (k) => {
    const v = Math.abs(k) / 1000;
    const sign = k < 0 ? "−" : "";
    if (v >= 1000) return `${sign}£${(v / 1000).toFixed(2)}bn`;
    return `${sign}£${v >= 100 ? v.toFixed(0) : v.toFixed(1)}m`;
  };
  // Keep a decimal near 100% so a club just over the line doesn't read as exactly 100%.
  const pct = (r) => {
    const v = r * 100;
    return Math.round(v) === 100 && Math.abs(v - 100) > 0.05 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
  };
  const signedPct = (r) => (r === null ? "–" : `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(Math.round(r * 100))}%`);
  const yearEnd = (iso) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const $ = (id) => document.getElementById(id);

  // ---------- Headline tiles ----------

  function renderTiles() {
    const overWages = clubs.filter((c) => c.wageRatio > 1).length;
    const revenue = clubs.reduce((s, c) => s + c.revenue, 0);
    const preTax = clubs.reduce((s, c) => s + c.preTax, 0);
    const lossMakers = clubs.filter((c) => c.preTax < 0).length;
    $("tiles").innerHTML = `
      <div class="tile hero"><div class="label">Clubs that spent more on wages than they earned</div>
        <div class="value">${overWages} of ${clubs.length}</div>
        <div class="sub">Staff costs above 100% of revenue</div></div>
      <div class="tile"><div class="label">Combined revenue</div><div class="value">${m(revenue)}</div>
        <div class="sub">Across all ${clubs.length} clubs</div></div>
      <div class="tile"><div class="label">Combined result before tax</div><div class="value">${m(preTax)}</div>
        <div class="sub">${lossMakers} of ${clubs.length} clubs made a loss</div></div>`;
  }

  // ---------- Charts ----------

  const tag = (c) => LEAGUE_SHORT[c.league2425];

  function wageChart() {
    const rows = [...clubs]
      .sort((a, b) => b.wageRatio - a.wageRatio)
      .map((c) => ({ id: c.slug, label: c.name, tag: tag(c), club: c, segments: [{ key: "ratio", value: c.wageRatio * 100 }] }));
    barChart($("chart-wages"), rows, { ratio: { label: "Wages / revenue", color: "var(--series-1)" } }, {
      ariaLabel: "Staff costs as a percentage of revenue, by club",
      format: (v) => pct(v / 100),
      tickFormat: (v) => `${v}%`,
      reference: { value: 100 },
      tooltip: (r) => ({
        title: `${r.club.name} · ${LEAGUES[r.club.league2425]} in 2024/25`,
        rows: [
          { value: pct(r.club.wageRatio), label: "of revenue spent on staff" },
          { value: m(r.club.staffCosts), label: "staff costs" },
          { value: m(r.club.revenue), label: "revenue" },
        ],
      }),
      onSelect: (r) => goToClub(r.club.slug),
    });
  }

  let mixMode = "money";
  function mixChart() {
    const rows = clubs
      .filter((c) => c.mixSplit)
      .sort((a, b) => b.revenue - a.revenue)
      .map((c) => {
        const scale = mixMode === "share" ? 100 / c.revenue : 1 / 1000;
        return {
          id: c.slug, label: c.name, tag: tag(c), club: c,
          segments: Object.keys(STREAMS).map((key) => ({ key, value: c[key] * scale })),
        };
      });
    barChart($("chart-mix"), rows, STREAMS, {
      ariaLabel: "Revenue by source, by club",
      format: (v) => (mixMode === "share" ? "" : `£${v.toFixed(0)}m`),
      tickFormat: (v) => (mixMode === "share" ? `${v}%` : `£${v}m`),
      tooltip: (r) => ({
        title: `${r.club.name} · revenue ${m(r.club.revenue)}`,
        rows: Object.entries(STREAMS).map(([key, s]) => ({
          color: s.color,
          value: `${m(r.club[key])} (${pct(r.club[key] / r.club.revenue)})`,
          label: s.label,
        })),
      }),
      onSelect: (r) => goToClub(r.club.slug),
    });
  }

  function resultChart() {
    const rows = [...clubs]
      .sort((a, b) => b.preTax - a.preTax)
      .map((c) => ({ id: c.slug, label: c.name, tag: tag(c), club: c, segments: [{ key: "result", value: c.preTax / 1000 }] }));
    barChart($("chart-result"), rows, {}, {
      ariaLabel: "Profit or loss before tax, by club",
      format: (v) => m(v * 1000),
      tickFormat: (v) => `${v < 0 ? "−" : ""}£${Math.abs(v)}m`,
      colorFor: (row, seg) => (seg.value < 0 ? "var(--loss)" : "var(--gain)"),
      tooltip: (r) => ({
        title: r.club.name,
        rows: [
          { value: m(r.club.preTax), label: r.club.preTax < 0 ? "loss before tax" : "profit before tax" },
          { value: m(r.club.playerSales), label: "profit on player sales" },
        ],
      }),
      onSelect: (r) => goToClub(r.club.slug),
    });
  }

  // ---------- Table ----------

  const COLUMNS = [
    { key: "name", label: "Club", get: (c) => c.name, html: (c) => `<a class="club-link" href="#${c.slug}">${c.name}</a>` },
    { key: "league2425", label: "2024/25 league", get: (c) => c.league2425, html: (c) => LEAGUES[c.league2425] },
    { key: "yearEnd", label: "Year end", get: (c) => c.yearEnd, html: (c) => yearEnd(c.yearEnd) },
    { key: "revenue", label: "Revenue", get: (c) => c.revenue, html: (c) => m(c.revenue) },
    { key: "revenueChange", label: "vs prior year", get: (c) => c.revenueChange ?? -Infinity, html: (c) => signedPct(c.revenueChange) },
    { key: "staffCosts", label: "Staff costs", get: (c) => c.staffCosts, html: (c) => m(c.staffCosts) },
    { key: "wageRatio", label: "Wages / revenue", get: (c) => c.wageRatio, html: (c) => pct(c.wageRatio) },
    { key: "playerSales", label: "Player sales profit", get: (c) => c.playerSales, html: (c) => m(c.playerSales) },
    { key: "preTax", label: "Result before tax", get: (c) => c.preTax, html: (c) => `<span class="${c.preTax < 0 ? "neg" : ""}">${m(c.preTax)}</span>` },
  ];
  let sort = { key: "wageRatio", dir: -1 };

  function renderTable() {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const rows = [...clubs].sort((a, b) => {
      const x = col.get(a);
      const y = col.get(b);
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
    });
    $("table").innerHTML = `
      <thead><tr>${COLUMNS.map(
        (c) => `<th scope="col" ${c.key === sort.key ? `aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button data-sort="${c.key}">${c.label}</button></th>`
      ).join("")}</tr></thead>
      <tbody>${rows.map((c) => `<tr data-club="${c.slug}">${COLUMNS.map((col) => `<td>${col.html(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }

  // ---------- Club detail ----------

  function delta(now, before) {
    if (before === undefined || before === null) return "";
    const diff = now - before;
    return `<div class="delta">${diff >= 0 ? "+" : "−"}${m(Math.abs(diff))} vs ${m(before)} the year before</div>`;
  }

  const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
  // dir -1: rank from the highest value down; dir 1: from the lowest up (e.g. biggest loss first).
  const rankOf = (c, key, dir = -1) => [...clubs].sort((a, b) => (dir < 0 ? b[key] - a[key] : a[key] - b[key])).findIndex((x) => x.slug === c.slug) + 1;

  function renderClub(c) {
    const p = c.prior || {};
    const bridge = [
      ["Revenue", c.revenue],
      ["Staff costs", -c.staffCosts],
      ["Other operating costs", -c.otherOpCosts],
      ["Player amortisation", -c.amortisation],
      ["Profit on player sales", c.playerSales],
      ["Other income, interest & one-offs", c.otherItems],
    ];
    // "Highest wage ratio", "4th-highest revenue", "Biggest loss"…
    const rankText = (n, word, what) => (n === 1 ? `${word[0].toUpperCase()}${word.slice(1)} ${what}` : `${ordinal(n)}-${word} ${what}`);
    const ranks = [
      rankText(rankOf(c, "wageRatio"), "highest", "wage ratio"),
      rankText(rankOf(c, "revenue"), "highest", "revenue"),
      c.preTax < 0 ? rankText(rankOf(c, "preTax", 1), "biggest", "loss") : rankText(rankOf(c, "preTax"), "best", "result"),
    ];
    $("club-body").innerHTML = `
      <div class="ranks">${ranks.map((r) => `<span class="chip"><b>${r}</b> of the ${clubs.length}</span>`).join("")}</div>

      <div class="kv">
        <div><div class="label">Revenue</div><div class="value">${m(c.revenue)}</div>${delta(c.revenue, p.revenue)}</div>
        <div><div class="label">Staff costs</div><div class="value">${m(c.staffCosts)}</div>${delta(c.staffCosts, p.staffCosts)}</div>
        <div><div class="label">Wages / revenue</div><div class="value">${pct(c.wageRatio)}</div>
          ${p.revenue && p.staffCosts ? `<div class="delta">${pct(p.staffCosts / p.revenue)} the year before</div>` : ""}</div>
        <div><div class="label">Result before tax</div><div class="value">${m(c.preTax)}</div>${delta(c.preTax, p.preTax)}</div>
        <div><div class="label">Profit on player sales</div><div class="value">${m(c.playerSales)}</div></div>
        <div><div class="label">Player amortisation</div><div class="value">${m(c.amortisation)}</div></div>
      </div>

      <div class="club-grid">
        <div class="card">
          <h2>Where the revenue came from</h2>
          <table class="data"><tbody>
            ${(c.mixSplit ? Object.entries(STREAMS) : [["matchday", { label: "Football (tickets and league income combined)", color: "var(--muted)" }], ["commercial", STREAMS.commercial]])
              .map(([k, s]) => `<tr><td><span class="swatch" style="background:${s.color}"></span>${s.label}</td><td>${m(c[k])}</td><td class="muted">${pct(c[k] / c.revenue)}</td></tr>`)
              .join("")}
          </tbody></table>
        </div>
        <div class="card">
          <h2>From revenue to ${c.preTax < 0 ? "loss" : "profit"}</h2>
          <table class="data"><tbody>
            ${bridge.map(([label, v]) => `<tr><td>${label}</td><td class="${v < 0 ? "neg" : ""}">${v < 0 ? "−" : "+"}${m(Math.abs(v))}</td></tr>`).join("")}
            <tr class="total"><td>Result before tax</td><td class="${c.preTax < 0 ? "neg" : ""}">${m(c.preTax)}</td></tr>
          </tbody></table>
        </div>
      </div>

      ${c.notes && c.notes.length ? `<div class="card"><h2>Notes</h2><ul class="notes">${c.notes.map((n) => `<li>${n}</li>`).join("")}</ul></div>` : ""}

      <div class="card">
        <h2>Source</h2>
        <p class="source">${c.companyName} (company ${c.companyNumber}), ${c.accountsType.toLowerCase()} accounts for the ${c.months === 12 ? "year" : `${c.months} months`} to ${new Date(c.yearEnd).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          <a href="${c.sourceUrl}" target="_blank" rel="noopener">Open the filing</a>${c.pages ? ` (income statement p.${c.pages.pnl}, revenue note p.${c.pages.revenue}, staff costs p.${c.pages.staff})` : ""}.</p>
      </div>`;
    $("club-title").textContent = c.name;
    $("club-meta").textContent = `${LEAGUES[c.league2425]} in 2024/25 · ${c.months === 12 ? "year" : `${c.months} months`} to ${yearEnd(c.yearEnd)}`;
    $("club-select").value = c.slug;
  }

  // ---------- Overview highlights ----------

  function renderHighlights() {
    const byWage = [...clubs].sort((a, b) => b.wageRatio - a.wageRatio);
    const byLoss = [...clubs].sort((a, b) => a.preTax - b.preTax);
    const profitable = clubs.filter((c) => c.preTax >= 0);
    const total = clubs.reduce((s, c) => s + c.revenue, 0);
    const fromPL = clubs.filter((c) => c.league2425 === "PL");
    const plShare = fromPL.reduce((s, c) => s + c.revenue, 0) / total;
    const sales = clubs.reduce((s, c) => s + c.playerSales, 0);
    const list = (items, value) =>
      `<ol class="mini">${items.map((c) => `<li><a href="#${c.slug}">${c.name}</a><span>${value(c)}</span></li>`).join("")}</ol>`;
    const cards = [
      {
        view: "wages", title: "Wages",
        text: `${byWage.filter((c) => c.wageRatio > 1).length} clubs spent more on staff than their entire revenue. The highest:`,
        body: list(byWage.slice(0, 3), (c) => pct(c.wageRatio)),
        cta: "Wage ratios for all 24 clubs",
      },
      {
        view: "revenue", title: "Revenue",
        text: `The ${fromPL.length} clubs that were in the Premier League in 2024/25 brought in ${Math.round(plShare * 100)}% of the 24 clubs' combined revenue. The biggest earners:`,
        body: list([...clubs].sort((a, b) => b.revenue - a.revenue).slice(0, 3), (c) => m(c.revenue)),
        cta: "Revenue sources for every club",
      },
      {
        view: "results", title: "Profit & loss",
        text: `Only ${profitable.length} ${profitable.length === 1 ? "club" : "clubs"} made a profit, even with ${m(sales)} of profit from selling players. The biggest losses:`,
        body: list(byLoss.slice(0, 3), (c) => m(c.preTax)),
        cta: "Results for all 24 clubs",
      },
    ];
    $("highlights").innerHTML = cards
      .map((h) => `<article class="card highlight"><h2>${h.title}</h2><p>${h.text}</p>${h.body}<a class="more" href="#${h.view}">${h.cta} →</a></article>`)
      .join("");
  }

  // ---------- Views ----------

  const VIEWS = ["overview", "wages", "revenue", "results", "clubs", "method"];

  function goToClub(slug) {
    location.hash = slug;
  }

  function showView() {
    const token = location.hash.slice(1);
    const club = clubs.find((c) => c.slug === token);
    const view = club ? "club" : VIEWS.includes(token) ? token : "overview";
    document.querySelectorAll("[data-view]").forEach((el) => (el.hidden = el.dataset.view !== view));
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const current = a.dataset.nav === view || (view === "club" && a.dataset.nav === "clubs");
      if (current) {
        a.setAttribute("aria-current", "page");
        // On phones the menu scrolls sideways: keep the current section visible in it.
        const tabs = a.parentElement;
        tabs.scrollLeft = Math.max(0, a.offsetLeft - (tabs.clientWidth - a.offsetWidth) / 2);
      } else a.removeAttribute("aria-current");
    });
    if (club) renderClub(club);
    window.Charts.hideTip();
    window.scrollTo(0, 0);
  }

  // ---------- Events ----------

  document.addEventListener("click", (e) => {
    const sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) {
      const key = sortBtn.dataset.sort;
      sort = { key, dir: sort.key === key ? -sort.dir : key === "name" || key === "league2425" ? 1 : -1 };
      renderTable();
      return;
    }
    const row = e.target.closest("tr[data-club]");
    if (row && !e.target.closest("a")) goToClub(row.dataset.club);
  });
  $("club-select").innerHTML = [...clubs].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.slug}">${c.name}</option>`).join("");
  $("club-select").addEventListener("change", (e) => goToClub(e.target.value));
  window.addEventListener("hashchange", showView);
  document.querySelectorAll("[data-mix]").forEach((btn) =>
    btn.addEventListener("click", () => {
      mixMode = btn.dataset.mix;
      document.querySelectorAll("[data-mix]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      mixChart();
    })
  );

  $("legend-mix").innerHTML = Object.values(STREAMS).map((s) => `<span><i style="background:${s.color}"></i>${s.label}</span>`).join("");
  const unsplit = clubs.filter((c) => !c.mixSplit).map((c) => c.name);
  $("mix-footnote").textContent = unsplit.length
    ? `Not shown: ${unsplit.join(", ")}. ${unsplit.length === 1 ? "Its accounts don't" : "Their accounts don't"} separate ticket income from league income.`
    : "";
  $("as-of").textContent = DATA.asOf;
  renderTiles();
  renderHighlights();
  showView();
  wageChart();
  mixChart();
  resultChart();
  renderTable();
})();
