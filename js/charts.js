// Horizontal bar charts drawn as plain SVG. One function covers the three charts on the
// page: single bars (wage ratio), stacked bars (revenue mix) and diverging bars (profit/loss).
(function (root) {
  "use strict";

  const SVG = "http://www.w3.org/2000/svg";
  const BAR = 16; // bar thickness (spec: ≤ 24px)
  const ROW = 30; // row pitch
  const RADIUS = 4; // rounded data-end
  const GAP = 2; // surface gap between stacked segments

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, content, attrs) {
    const node = el("text", attrs, parent);
    node.textContent = content;
    return node;
  }

  // A bar with only its data-end rounded; the baseline end stays square.
  function barPath(x0, x1, y, h) {
    const w = Math.abs(x1 - x0);
    const r = Math.min(RADIUS, w / 2, h / 2);
    if (w < 0.5) return "";
    if (x1 >= x0) {
      return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
    }
    return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
  }

  // Width of a label as it will render, so the label column fits the longest name.
  const measureCtx = document.createElement("canvas").getContext("2d");
  function textWidth(str, size) {
    measureCtx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    return measureCtx.measureText(str).width;
  }

  function niceStep(span, target) {
    const raw = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    return (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  }

  // ---------- Tooltip (one per page) ----------

  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "presentation");
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));

  function showTip(content, x, y) {
    tip.replaceChildren();
    const title = document.createElement("div");
    title.className = "t-title";
    title.textContent = content.title;
    tip.appendChild(title);
    for (const row of content.rows) {
      const line = document.createElement("div");
      line.className = "t-row";
      if (row.color) {
        const key = document.createElement("i");
        key.className = "key";
        key.style.background = row.color;
        line.appendChild(key);
      }
      const value = document.createElement("b");
      value.textContent = row.value;
      const label = document.createElement("span");
      label.textContent = row.label;
      line.append(value, label);
      tip.appendChild(line);
    }
    tip.style.display = "block";
    const { width, height } = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(x + 14, window.innerWidth - width - 8)}px`;
    tip.style.top = `${Math.min(y + 14, window.innerHeight - height - 8)}px`;
  }

  function hideTip() {
    tip.style.display = "none";
  }

  // ---------- Chart ----------

  // rows:    [{ id, label, tag, segments: [{ key, value }] }]  (one segment for simple bars)
  // series:  { key: { label, color } } — colour per segment key (CSS var strings)
  // options: format(v), tickFormat(v), reference { value, label }, tooltip(row), onSelect(row), colorFor(row, seg)
  function barChart(container, rows, series, options) {
    const draw = () => {
      container.replaceChildren();
      const width = Math.max(container.clientWidth, 300);
      const narrow = width < 560;
      // Wide: name (and league tag) in a column left of the bars.
      // Narrow: name on its own line above each bar, so bars get the full width.
      const nameW = Math.max(...rows.map((r) => textWidth(r.label, 13)));
      const tagW = narrow ? 0 : Math.max(0, ...rows.map((r) => (r.tag ? textWidth(r.tag, 11) : 0)));
      const labelW = narrow ? 0 : Math.min(260, nameW + (tagW ? tagW + 14 : 0) + 12);
      const rowH = narrow ? 44 : ROW;
      const valueW = 64;
      const top = 22;
      const height = top + rows.length * rowH + 4;

      const totals = rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0));
      let min = Math.min(0, ...totals);
      let max = Math.max(0, ...totals, options.reference ? options.reference.value : 0);
      const step = niceStep(max - min || 1, narrow ? 3 : 5);
      min = Math.floor(min / step) * step;
      max = Math.ceil(max / step) * step;

      // Leave room for value labels on whichever side bars grow.
      const left = labelW + (min < 0 ? valueW : narrow ? 0 : 8);
      const right = width - valueW;
      const x = (v) => left + ((v - min) / (max - min)) * (right - left);

      const svg = el("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, role: "group", "aria-label": options.ariaLabel || "" });

      // Gridlines and ticks; skip tick labels that would collide.
      const stepPx = x(min + step) - x(min);
      const widest = Math.max(textWidth(options.tickFormat(min), 11), textWidth(options.tickFormat(max), 11));
      const every = Math.max(1, Math.ceil((widest + 12) / stepPx));
      for (let v = min, i = 0; v <= max + step / 2; v += step, i++) {
        el("line", { class: v === 0 ? "base" : "grid", x1: x(v), x2: x(v), y1: top - 6, y2: height }, svg);
        if (i % every === 0 || v === 0) {
          const anchor = narrow && v === min && min === 0 ? "start" : "middle";
          text(svg, options.tickFormat(v), { class: "tick", x: x(v), y: 10, "text-anchor": anchor });
        }
      }

      if (options.reference) {
        const rx = x(options.reference.value);
        el("line", { class: "ref", x1: rx, x2: rx, y1: top - 6, y2: height }, svg);
      }

      rows.forEach((row, i) => {
        const y = top + i * rowH;
        const g = el("g", { class: "row", tabindex: 0, role: "button", "aria-label": `${row.label}: ${options.format(totals[i])}` }, svg);
        el("rect", { class: "hit", x: 0, y, width, height: rowH, rx: 6 }, g);
        if (narrow) {
          text(g, row.label, { class: "club", x: 0, y: y + 14 });
        } else {
          const label = text(g, row.label, { class: "club", x: 0, y: y + ROW / 2 + 4 });
          // Shorten names that don't fit the capped column (full name stays in the tooltip and table).
          const room = labelW - (tagW ? tagW + 14 : 0) - 10;
          if (textWidth(row.label, 13) > room) {
            let s = row.label;
            while (s.length > 3 && textWidth(`${s}…`, 13) > room) s = s.slice(0, -1);
            label.textContent = `${s.trimEnd()}…`;
          }
          if (row.tag) text(g, row.tag, { class: "tag", x: labelW - 12, y: y + ROW / 2 + 4, "text-anchor": "end" });
        }

        const by = narrow ? y + 20 : y + (ROW - BAR) / 2;
        let cursor = 0;
        row.segments.forEach((seg, j) => {
          const isLast = j === row.segments.length - 1;
          const from = x(cursor);
          const to = x(cursor + seg.value);
          cursor += seg.value;
          // Stacked segments are separated by a surface gap; only the last one gets a rounded end.
          const end = isLast ? to : to - GAP;
          const color = options.colorFor ? options.colorFor(row, seg) : series[seg.key].color;
          if (isLast) el("path", { d: barPath(from, end, by, BAR), fill: color }, g);
          else if (end > from) el("rect", { x: from, y: by, width: end - from, height: BAR, fill: color }, g);
        });

        const total = totals[i];
        const tx = x(total);
        text(g, options.format(total), {
          class: "value",
          x: total < 0 ? tx - 6 : tx + 6,
          y: by + BAR / 2 + 4,
          "text-anchor": total < 0 ? "end" : "start",
        });

        const show = (e) => {
          const rect = e.type === "focus" ? g.getBoundingClientRect() : null;
          showTip(options.tooltip(row), rect ? rect.right - 220 : e.clientX, rect ? rect.top : e.clientY);
        };
        g.addEventListener("pointermove", show);
        g.addEventListener("focus", show);
        g.addEventListener("pointerleave", hideTip);
        g.addEventListener("blur", hideTip);
        g.addEventListener("click", () => options.onSelect(row));
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            options.onSelect(row);
          }
        });
      });

      container.appendChild(svg);
    };

    draw();
    let last = container.clientWidth;
    new ResizeObserver(() => {
      if (container.clientWidth !== last) {
        last = container.clientWidth;
        draw();
      }
    }).observe(container);
    return { redraw: draw };
  }

  root.Charts = { barChart, hideTip };
})(window);
