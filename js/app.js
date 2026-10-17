/* داشبورد طلا و ارز — app logic (no dependencies) */
(function () {
  'use strict';

  /* Data comes from the repo itself (like an API): GitHub raw serves the latest
     committed dashboard_data.json within minutes, so data updates do NOT
     require a Pages redeploy. Local file is the offline fallback. */
  var CACHE_BUST = Math.floor(Date.now() / 600000); // 10-min buckets
  var DATA_URLS = [
    'https://raw.githubusercontent.com/mewshiam/Cheghadr-Dashboard/main/data/dashboard_data.json?t=' + CACHE_BUST,
    'data/dashboard_data.json'
  ];
  var ASSET_ORDER = ['dollar', 'gold18', 'sekee', 'sekeb', 'nim', 'rob', 'gerami', 'tether'];
  var COIN_KEYS = ['sekee', 'sekeb', 'nim', 'rob', 'gerami'];
  var SHAMSI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  var GREG_MONTHS_FA = ['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  var state = { data: null, asset: 'dollar', onsCal: 'shamsi' };

  /* ---------- formatting ---------- */
  function fa(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('fa-IR');
  }
  function faYear(y) {
    // years never use thousands separators: ۱۴۰۵ not ۱٬۴۰۵
    if (y === null || y === undefined || isNaN(y)) return '—';
    return Number(y).toLocaleString('fa-IR', { useGrouping: false });
  }
  function faPct(x) {
    if (x === null || x === undefined || isNaN(x)) return '—';
    var sign = x > 0 ? '+' : '';
    return sign + Number(x).toLocaleString('fa-IR', { maximumFractionDigits: 2 }) + '٪';
  }
  function dirClass(x) { return x > 0 ? 'up' : (x < 0 ? 'down' : ''); }
  function el(id) { return document.getElementById(id); }

  function loadData(urls, idx) {
    idx = idx || 0;
    return fetch(urls[idx]).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (err) {
      if (idx + 1 < urls.length) return loadData(urls, idx + 1);
      throw err;
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    loadData(DATA_URLS)
      .then(function (data) {
        state.data = data;
        renderMeta();
        renderTabs();
        selectAsset('dollar');
      })
      .catch(function (err) {
        el('meta-line').textContent = 'خطا در بارگذاری داده: ' + err.message;
        el('content').innerHTML = '<section class="card"><p>داده بارگذاری نشد. لطفاً اتصال اینترنت را بررسی کنید.</p></section>';
      });
  });

  function renderMeta() {
    var m = state.data.meta || {};
    el('meta-line').textContent = 'آخرین به‌روزرسانی داده: ' + (m.updated || '—') +
      ' · ' + fa(m.count) + ' رکورد روزانه';
  }

  /* ---------- tabs ---------- */
  function renderTabs() {
    var bar = el('tabbar');
    bar.innerHTML = '';
    ASSET_ORDER.forEach(function (key) {
      var a = state.data.assets[key];
      if (!a) return;
      var b = document.createElement('button');
      b.className = 'tab' + (key === state.asset ? ' active' : '');
      b.textContent = a.name;
      b.dataset.asset = key;
      b.addEventListener('click', function () { selectAsset(key); });
      bar.appendChild(b);
    });
    // 9th tab: gold ounce
    if (state.data.ons) {
      var ob = document.createElement('button');
      ob.className = 'tab' + (state.asset === 'ons' ? ' active' : '');
      ob.textContent = state.data.ons.name || 'انس طلا';
      ob.dataset.asset = 'ons';
      ob.addEventListener('click', function () { selectAsset('ons'); });
      bar.appendChild(ob);
    }
  }

  function selectAsset(key) {
    state.asset = key;
    document.body.dataset.asset = key;
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.asset === key); });
    // hide conditional sections; each renderer unhides its own
    el('bubble-card').hidden = true;
    el('gold-decomp-card').hidden = true;
    el('ons-calendar-card').hidden = true;
    el('weekly-card').hidden = false;

    if (key === 'ons') {
      renderOnsTab();
    } else {
      var asset = state.data.assets[key];
      var live = state.data.live[key];
      renderLive(asset, live);
      drawChart(asset);
      renderMonthGrid(asset);
      renderWeekly(asset);
      renderCompare(asset);
      renderTop5(asset);
      renderSeasonal(asset);
      if (COIN_KEYS.indexOf(key) >= 0) renderBubble(key);
      if (key === 'gold18') renderGoldDecomp();
    }
    var active = document.querySelector('.tab.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /* ---------- bubble (coin tabs) ---------- */

  /* ---------- live card ---------- */
  function renderLive(asset, live) {
    var box = el('live-card');
    if (!live) {
      box.innerHTML = '<p>قیمت زنده در دسترس نیست.</p>';
      return;
    }
    var chgCls = live.changePct > 0 ? 'up' : (live.changePct < 0 ? 'down' : 'flat');
    var arrow = live.changePct > 0 ? '▲ ' : (live.changePct < 0 ? '▼ ' : '');
    var srcLabel = live.source === 'telegram' ? 'کانال تلگرام' : 'tgju.org';

    var html = '<div class="live-label"><span class="live-dot"></span>قیمت زنده ' + asset.name + '</div>';
    // dollar 3-part: naghdi / fardaei / avg_naghdi (from Telegram channel)
    if (state.asset === 'dollar' && live.price_naghdi !== undefined) {
      html += '<div class="dollar-parts">';
      html += '<div class="dollar-part"><span class="dp-label">دلار نقدی 💵</span><span class="dp-value">' + fa(live.price_naghdi) + '</span></div>';
      if (live.price_fardaei !== null && live.price_fardaei !== undefined) {
        html += '<div class="dollar-part"><span class="dp-label">دلار فردایی ⏳</span><span class="dp-value">' + fa(live.price_fardaei) + '</span></div>';
      }
      if (live.avg_naghdi !== null && live.avg_naghdi !== undefined) {
        html += '<div class="dollar-part"><span class="dp-label">میانگین نقدی روز</span><span class="dp-value">' + fa(live.avg_naghdi) + '</span></div>';
      }
      html += '</div>';
    } else {
      html += '<div class="live-price">' + fa(live.price) + ' <span class="unit">' + asset.unit + '</span></div>';
    }
    if (live.avg_price !== null && live.avg_price !== undefined && state.asset !== 'dollar') {
      html += '<p class="live-avg">قیمت میانگین روز: <strong>' + fa(live.avg_price) + ' تومان</strong></p>';
    }
    html += '<div><span class="live-change ' + chgCls + '">' + arrow + faPct(live.changePct) + '</span></div>';
    html += '<div class="live-meta"><span>به‌روزرسانی ' + live.date +
      (live.time ? '، ساعت ' + live.time : '') + '</span>' +
      '<span class="source-badge">' + srcLabel + '</span></div>';
    box.innerHTML = html;
  }

  /* ---------- chart (canvas) ---------- */
  var chartData = null;
  function drawChart(asset) {
    chartData = asset.daily || [];
    var canvas = el('chart');
    requestAnimationFrame(function () { paintChart(canvas); });
  }

  function paintChart(canvas) {
    var data = chartData;
    if (!data || !data.length) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var css = getComputedStyle(document.body);
    var accent = css.getPropertyValue('--accent').trim() || '#16a34a';
    var muted = css.getPropertyValue('--muted').trim() || '#6b7280';
    var gridC = css.getPropertyValue('--border').trim() || '#e5e7eb';

    var prices = data.map(function (d) { return d.p; });
    var min = Math.min.apply(null, prices), max = Math.max.apply(null, prices);
    var pad = (max - min) * 0.08 || 1;
    min -= pad; max += pad;

    var padL = 8, padR = 8, padT = 14, padB = 26;
    var iw = w - padL - padR, ih = h - padT - padB;
    function X(i) { return padL + (i / (data.length - 1)) * iw; }
    function Y(p) { return padT + (1 - (p - min) / (max - min)) * ih; }

    // gridlines
    ctx.strokeStyle = gridC; ctx.lineWidth = 1;
    ctx.fillStyle = muted; ctx.font = '11px Tahoma'; ctx.textAlign = 'right';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (g / 4) * ih;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
      var gv = max - (g / 4) * (max - min);
      ctx.fillText(fa(Math.round(gv)), w - padR - 2, gy - 3);
    }

    // area fill
    var grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, hexA(accent, 0.35));
    grad.addColorStop(1, hexA(accent, 0.02));
    ctx.beginPath();
    ctx.moveTo(X(0), Y(prices[0]));
    for (var i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(prices[i]));
    ctx.lineTo(X(data.length - 1), h - padB);
    ctx.lineTo(X(0), h - padB);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(X(0), Y(prices[0]));
    for (var j = 1; j < data.length; j++) ctx.lineTo(X(j), Y(prices[j]));
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // year ticks on x-axis (handles both YYYY/MM/DD and YYYY-MM-DD; no grouping for years)
    ctx.fillStyle = muted; ctx.textAlign = 'center';
    var seenYears = {};
    for (var k = 0; k < data.length; k += Math.max(1, Math.floor(data.length / 8))) {
      var y = String(data[k].d).split(/[-\/]/)[0];
      if (!seenYears[y]) { seenYears[y] = 1; ctx.fillText(faYear(y), X(k), h - 8); }
    }

    // min/max labels
    var iMin = prices.indexOf(Math.min.apply(null, prices));
    var iMax = prices.indexOf(Math.max.apply(null, prices));
    ctx.font = 'bold 11px Tahoma';
    ctx.fillStyle = accent;
    ctx.fillText('سقف ' + fa(prices[iMax]), Math.min(Math.max(X(iMax), 50), w - 50), Y(prices[iMax]) - 6);
    ctx.fillStyle = muted;
    ctx.fillText('کف ' + fa(prices[iMin]), Math.min(Math.max(X(iMin), 50), w - 50), Y(prices[iMin]) + 14);

    el('chart-legend').innerHTML =
      '<span>از ' + data[0].d + ' تا ' + data[data.length - 1].d + '</span>' +
      '<span>' + fa(data.length) + ' روز</span>';
  }

  function hexA(hex, a) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  window.addEventListener('resize', function () {
    if (chartData) { var c = el('chart'); requestAnimationFrame(function () { paintChart(c); }); }
  });

  /* ---------- 12-month grid ---------- */
  function renderMonthGrid(asset) {
    var grid = el('month-grid');
    var years = asset.years || [];
    var curYear = Math.max.apply(null, years);
    el('month-grid-title').textContent = 'عملکرد ماه‌های سال ' + faYear(curYear);
    var byMonth = {};
    (asset.monthly || []).forEach(function (m) { if (m.y === curYear) byMonth[m.m] = m; });
    var names = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
    var html = '';
    for (var m = 1; m <= 12; m++) {
      var rec = byMonth[m];
      if (rec) {
        html += '<div class="month-cell"><div class="m-name">' + names[m - 1] + '</div>' +
          '<div class="m-pct ' + dirClass(rec.changePct) + '">' + faPct(rec.changePct) + '</div></div>';
      } else {
        html += '<div class="month-cell empty"><div class="m-name">' + names[m - 1] + '</div>' +
          '<div class="m-pct">—</div></div>';
      }
    }
    grid.innerHTML = html;
  }

  /* ---------- weekly ---------- */
  function renderWeekly(asset) {
    var weeks = (asset.weekly || []).slice(-12).reverse();
    var tbody = document.querySelector('#weekly-table tbody');
    var html = '';
    weeks.forEach(function (w) {
      html += '<tr><td>' + faYear(w.y) + '/' + fa(w.m) + ' · هفته ' + fa(w.w) +
        ' <span style="color:var(--muted)">(' + w.range + ')</span></td>' +
        '<td class="num">' + fa(w.avg) + '</td>' +
        '<td class="' + dirClass(w.changePct) + '">' + faPct(w.changePct) + '</td></tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="3">داده‌ای نیست.</td></tr>';
  }

  /* ---------- period comparison ---------- */
  function renderCompare(asset) {
    var years = asset.years || [];
    var from = el('cmp-from'), to = el('cmp-to');
    from.innerHTML = ''; to.innerHTML = '';
    years.forEach(function (y) {
      var o1 = document.createElement('option'); o1.value = y; o1.textContent = faYear(y); from.appendChild(o1);
      var o2 = document.createElement('option'); o2.value = y; o2.textContent = faYear(y); to.appendChild(o2);
    });
    if (years.length) {
      from.value = years[0];
      to.value = years[years.length - 1];
    }
    function update() { updateCompare(asset, parseInt(from.value, 10), parseInt(to.value, 10)); }
    from.onchange = update; to.onchange = update;
    update();
  }

  function updateCompare(asset, y1, y2) {
    var box = el('compare-result');
    if (!(y1 && y2) || y1 > y2) { box.innerHTML = '<p style="grid-column:1/-1;color:var(--muted)">بازه معتبر انتخاب کنید.</p>'; return; }
    var daily = asset.daily || [];
    var first = null, last = null;
    for (var i = 0; i < daily.length; i++) {
      var y = parseInt(String(daily[i].d).split(/[-\/]/)[0], 10);
      if (y === y1 && !first) first = daily[i];
      if (y === y2) last = daily[i];
    }
    if (!first || !last) { box.innerHTML = '<p style="grid-column:1/-1;color:var(--muted)">داده کافی نیست.</p>'; return; }
    var chg = (last.p - first.p) / first.p * 100;
    box.innerHTML =
      '<div class="compare-box"><div class="c-label">ابتدای ' + faYear(y1) + '</div><div class="c-value">' + fa(first.p) + '</div></div>' +
      '<div class="compare-box"><div class="c-label">انتهای ' + faYear(y2) + '</div><div class="c-value">' + fa(last.p) + '</div></div>' +
      '<div class="compare-box"><div class="c-label">تغییر کل دوره</div><div class="c-value ' + dirClass(chg) + '">' + faPct(chg) + '</div></div>';
  }

  /* ---------- top 5 months ---------- */
  function renderTop5(asset) {
    var list = (asset.top5months || []).slice().sort(function (a, b) { return b.avgChangePct - a.avgChangePct; }).slice(0, 5);
    var maxV = Math.max.apply(null, list.map(function (t) { return Math.abs(t.avgChangePct); }).concat([1]));
    var html = '';
    list.forEach(function (t, i) {
      var w = Math.round(Math.abs(t.avgChangePct) / maxV * 100);
      html += '<div class="top5-row"><div class="top5-head"><span><span class="rank">' + fa(i + 1) + '</span>' +
        t.name + '</span><span class="' + dirClass(t.avgChangePct) + '">' + faPct(t.avgChangePct) + '</span></div>' +
        '<div class="top5-bar"><div class="top5-fill" style="width:' + w + '%"></div></div></div>';
    });
    el('top5').innerHTML = html || '<p>داده‌ای نیست.</p>';
  }

  /* ---------- seasonal ---------- */
  function renderSeasonal(asset) {
    var list = (asset.seasonal || []).slice().sort(function (a, b) { return a.m - b.m; });
    var maxV = Math.max.apply(null, list.map(function (s) { return Math.abs(s.avgChangePct); }).concat([1]));
    var html = '';
    list.forEach(function (s) {
      var w = Math.round(Math.abs(s.avgChangePct) / maxV * 100);
      var cls = s.avgChangePct >= 0 ? 'up' : 'down';
      html += '<div class="season-row"><div class="season-name">' + s.name + '</div>' +
        '<div class="season-bar"><div class="season-fill ' + cls + '" style="width:' + w + '%"></div></div>' +
        '<div class="season-val"><span class="' + dirClass(s.avgChangePct) + '">' + faPct(s.avgChangePct) + '</span> · ' +
        fa(s.upYears) + '/' + fa(s.totalYears) + ' صعودی</div></div>';
    });
    el('seasonal').innerHTML = html || '<p>داده‌ای نیست.</p>';
  }

  /* ---------- bubble (coin tabs) ---------- */
  function bubbleLevel(pct) {
    if (pct < 0) return 'lvl-neg';
    if (pct < 5) return 'lvl-low';
    if (pct < 15) return 'lvl-mid';
    if (pct < 25) return 'lvl-high';
    return 'lvl-max';
  }

  function renderBubble(coinKey) {
    var b = state.data.bubble;
    if (!b || !b.coins || !b.coins[coinKey]) return;
    var c = b.coins[coinKey];
    var L = c.latest || {};
    el('bubble-card').hidden = false;

    var html = '';
    html += '<div class="bubble-stat"><div class="b-label">قیمت بازار</div>' +
      '<div class="b-value">' + fa(L.market) + '</div></div>';
    html += '<div class="bubble-stat"><div class="b-label">ارزش ذاتی</div>' +
      '<div class="b-value">' + fa(L.intrinsic) + '</div></div>';
    html += '<div class="bubble-stat wide"><div class="b-label">حباب (' + (L.d || '') + ')</div>' +
      '<div class="b-value bubble-pct ' + bubbleLevel(L.pct) + '">' + faPct(L.pct) + '</div>' +
      '<div class="b-label" style="margin-top:4px">' + fa(L.bubble) + ' تومان بالاتر از ارزش ذاتی</div></div>';
    el('bubble-stats').innerHTML = html;

    // bubble history mini-chart (pct over time)
    var daily = c.daily || [];
    var canvas = el('bubble-chart');
    requestAnimationFrame(function () {
      paintPctChart(canvas, daily.map(function (d) { return { d: d.d, p: d.pct }; }), 'bubble-legend', 'درصد حباب');
    });
  }

  function paintPctChart(canvas, data, legendId, label) {
    if (!data || !data.length) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var css = getComputedStyle(document.body);
    var muted = css.getPropertyValue('--muted').trim() || '#6b7280';
    var gridC = css.getPropertyValue('--border').trim() || '#e5e7eb';

    var vals = data.map(function (d) { return d.p; });
    var min = Math.min.apply(null, vals.concat([0]));
    var max = Math.max.apply(null, vals.concat([0]));
    var pad = (max - min) * 0.1 || 1;
    min -= pad; max += pad;

    var padL = 8, padR = 8, padT = 12, padB = 22;
    var iw = w - padL - padR, ih = h - padT - padB;
    function X(i) { return padL + (i / (data.length - 1)) * iw; }
    function Y(v) { return padT + (1 - (v - min) / (max - min)) * ih; }

    // zero line
    ctx.strokeStyle = muted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
    ctx.setLineDash([]);

    // area
    ctx.beginPath();
    ctx.moveTo(X(0), Y(vals[0]));
    for (var i = 1; i < data.length; i++) ctx.lineTo(X(i), Y(vals[i]));
    ctx.lineTo(X(data.length - 1), Y(0));
    ctx.lineTo(X(0), Y(0));
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, 'rgba(234,88,12,0.3)');
    grad.addColorStop(1, 'rgba(234,88,12,0.03)');
    ctx.fillStyle = grad; ctx.fill();

    // line with per-point coloring by level
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
    var started = false;
    for (var j = 0; j < data.length; j++) {
      var lvl = bubbleLevel(vals[j]);
      ctx.strokeStyle = lvl === 'lvl-neg' ? '#2563eb' : lvl === 'lvl-low' ? '#16a34a' :
        lvl === 'lvl-mid' ? '#d97706' : lvl === 'lvl-high' ? '#ea580c' : '#dc2626';
      ctx.beginPath();
      if (j === 0) { ctx.moveTo(X(0), Y(vals[0])); }
      else { ctx.moveTo(X(j - 1), Y(vals[j - 1])); ctx.lineTo(X(j), Y(vals[j])); }
      ctx.stroke();
    }

    ctx.fillStyle = muted; ctx.font = '11px Tahoma'; ctx.textAlign = 'center';
    for (var k = 0; k < data.length; k += Math.max(1, Math.floor(data.length / 6))) {
      ctx.fillText(faYear(data[k].d.split('/')[0]), X(k), h - 6);
    }
    el(legendId).innerHTML = '<span>' + label + ' — از ' + data[0].d + ' تا ' + data[data.length - 1].d + '</span>' +
      '<span>آخرین: ' + faPct(vals[vals.length - 1]) + '</span>';
  }

  /* ---------- gold 18k decomposition ---------- */
  function renderGoldDecomp() {
    var b = state.data.bubble;
    var live = state.data.live || {};
    if (!b || !b.gold) return;
    el('gold-decomp-card').hidden = false;

    var onsP = live.ons ? live.ons.price : null;
    var dolP = live.dollar ? live.dollar.price : null;
    var mktP = live.gold18 ? live.gold18.price : null;
    var theo = (onsP && dolP) ? Math.round(onsP * dolP / 31.1034768 * 0.75) : null;
    var prem = (theo && mktP) ? (mktP - theo) / theo * 100 : null;
    var L = b.gold.latest || {};

    var html = '<div class="decomp-flow">';
    html += '<div class="decomp-row"><span class="d-label">انس جهانی طلا</span>' +
      '<span class="d-value">' + (onsP ? '$' + fa(onsP) : '—') + '</span></div>';
    html += '<div class="decomp-op">×</div>';
    html += '<div class="decomp-row"><span class="d-label">نرخ دلار</span>' +
      '<span class="d-value">' + (dolP ? fa(dolP) + ' تومان' : '—') + '</span></div>';
    html += '<div class="decomp-op">↓ <span style="font-size:.75rem">÷ ۳۱٫۱۰۳۵ × ۰٫۷۵</span></div>';
    html += '<div class="decomp-row"><span class="d-label">قیمت تئوریک طلای ۱۸ عیار</span>' +
      '<span class="d-value">' + (theo ? fa(theo) + ' تومان' : '—') + '</span></div>';
    html += '<div class="decomp-op">⇅</div>';
    html += '<div class="decomp-row"><span class="d-label">قیمت بازار</span>' +
      '<span class="d-value">' + (mktP ? fa(mktP) + ' تومان' : '—') + '</span></div>';
    html += '<div class="decomp-row result"><span class="d-label">پریمیوم بازار نسبت به تئوریک</span>' +
      '<span class="d-value ' + dirClass(prem) + '">' + faPct(prem) + '</span></div>';
    html += '</div>';
    html += '<p class="decomp-note">بر اساس آخرین قیمت زنده · داده تاریخی: ' + (L.d || '—') +
      ' تئوریک ' + fa(L.theo) + ' / بازار ' + fa(L.market) + '</p>';
    el('decomp-body').innerHTML = html;

    var daily = b.gold.daily || [];
    var canvas = el('premium-chart');
    requestAnimationFrame(function () {
      paintPctChart(canvas, daily.map(function (d) { return { d: d.d, p: d.premPct }; }), 'premium-legend', 'پریمیوم ٪');
    });
  }

  /* ---------- ons tab (9th) ---------- */
  function onsCalData() {
    return state.data.ons[state.onsCal];
  }

  function monthName(cal, m) {
    if (cal === 'shamsi') return SHAMSI_MONTHS[m - 1] || ('ماه ' + fa(m));
    return GREG_MONTHS_FA[m - 1] || ('ماه ' + fa(m));
  }

  function renderOnsTab() {
    var o = state.data.ons;
    if (!o) return;
    el('ons-calendar-card').hidden = false;
    el('weekly-card').hidden = true; // no weekly data for ons

    // calendar toggle wiring
    var btns = document.querySelectorAll('.cal-btn');
    btns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.cal === state.onsCal);
      btn.onclick = function () {
        if (state.onsCal !== btn.dataset.cal) {
          state.onsCal = btn.dataset.cal;
          renderOnsTab();
        }
      };
    });

    var cal = onsCalData();
    var isShamsi = state.onsCal === 'shamsi';

    // live card: USD + toman equivalent
    var live = state.data.live.ons || {};
    var dolP = state.data.live.dollar ? state.data.live.dollar.price : null;
    var tomanEq = (live.price && dolP) ? Math.round(live.price * dolP) : null;
    var box = el('live-card');
    var chgCls = live.changePct > 0 ? 'up' : (live.changePct < 0 ? 'down' : 'flat');
    var arrow = live.changePct > 0 ? '▲ ' : (live.changePct < 0 ? '▼ ' : '');
    var html = '<div class="live-label"><span class="live-dot"></span>قیمت زنده انس طلا</div>';
    html += '<div class="live-price">$' + fa(live.price) + '</div>';
    if (tomanEq) html += '<p class="live-avg">معادل تومانی: <strong>' + fa(tomanEq) + ' تومان</strong></p>';
    html += '<div><span class="live-change ' + chgCls + '">' + arrow + faPct(live.changePct) + '</span></div>';
    html += '<div class="live-meta"><span>به‌روزرسانی ' + (live.date || '') +
      (live.time ? '، ساعت ' + live.time : '') + '</span>' +
      '<span class="source-badge">tgju.org</span></div>';
    box.innerHTML = html;

    // adapted asset for shared renderers
    var pseudo = {
      name: o.name,
      unit: 'دلار',
      daily: o.daily.map(function (d) { return { d: isShamsi ? d.d : d.g, p: d.p }; }),
      monthly: cal.monthly,
      weekly: [],
      seasonal: null, // handled separately via seasons
      top5months: cal.top5months.map(function (t) {
        return { name: monthName(state.onsCal, t.m), avgChangePct: t.avgChangePct };
      }),
      years: cal.years
    };
    drawChart(pseudo);
    renderMonthGridOns(pseudo);
    renderCompareOns(pseudo);
    renderTop5(pseudo);
    renderSeasonalOns(cal.seasons || []);
  }

  function renderMonthGridOns(pseudo) {
    var grid = el('month-grid');
    var years = pseudo.years || [];
    var curYear = Math.max.apply(null, years);
    var isShamsi = state.onsCal === 'shamsi';
    el('month-grid-title').textContent = 'عملکرد ماه‌های سال ' +
      (isShamsi ? faYear(curYear) : fa(curYear));
    var byMonth = {};
    (pseudo.monthly || []).forEach(function (m) { if (m.y === curYear) byMonth[m.m] = m; });
    var html = '';
    for (var m = 1; m <= 12; m++) {
      var rec = byMonth[m];
      var nm = monthName(state.onsCal, m);
      if (rec) {
        html += '<div class="month-cell"><div class="m-name">' + nm + '</div>' +
          '<div class="m-pct ' + dirClass(rec.changePct) + '">' + faPct(rec.changePct) + '</div></div>';
      } else {
        html += '<div class="month-cell empty"><div class="m-name">' + nm + '</div>' +
          '<div class="m-pct">—</div></div>';
      }
    }
    grid.innerHTML = html;
  }

  function renderCompareOns(pseudo) {
    // reuse generic compare but with ons daily (dates may be g: YYYY-MM-DD)
    var years = pseudo.years || [];
    var from = el('cmp-from'), to = el('cmp-to');
    from.innerHTML = ''; to.innerHTML = '';
    var isShamsi = state.onsCal === 'shamsi';
    years.forEach(function (y) {
      var o1 = document.createElement('option'); o1.value = y;
      o1.textContent = isShamsi ? faYear(y) : fa(y); from.appendChild(o1);
      var o2 = document.createElement('option'); o2.value = y;
      o2.textContent = isShamsi ? faYear(y) : fa(y); to.appendChild(o2);
    });
    if (years.length) { from.value = years[0]; to.value = years[years.length - 1]; }
    function update() {
      var y1 = parseInt(from.value, 10), y2 = parseInt(to.value, 10);
      var box = el('compare-result');
      if (!(y1 && y2) || y1 > y2) { box.innerHTML = '<p style="grid-column:1/-1;color:var(--muted)">بازه معتبر انتخاب کنید.</p>'; return; }
      var daily = pseudo.daily || [];
      var first = null, last = null;
      for (var i = 0; i < daily.length; i++) {
        var y = parseInt(String(daily[i].d).split(/[-\/]/)[0], 10);
        if (y === y1 && !first) first = daily[i];
        if (y === y2) last = daily[i];
      }
      if (!first || !last) { box.innerHTML = '<p style="grid-column:1/-1;color:var(--muted)">داده کافی نیست.</p>'; return; }
      var chg = (last.p - first.p) / first.p * 100;
      var yl = function (y) { return isShamsi ? faYear(y) : fa(y); };
      box.innerHTML =
        '<div class="compare-box"><div class="c-label">ابتدای ' + yl(y1) + '</div><div class="c-value">$' + fa(Math.round(first.p)) + '</div></div>' +
        '<div class="compare-box"><div class="c-label">انتهای ' + yl(y2) + '</div><div class="c-value">$' + fa(Math.round(last.p)) + '</div></div>' +
        '<div class="compare-box"><div class="c-label">تغییر کل دوره</div><div class="c-value ' + dirClass(chg) + '">' + faPct(chg) + '</div></div>';
    }
    from.onchange = update; to.onchange = update;
    update();
  }

  function renderSeasonalOns(seasons) {
    var maxV = Math.max.apply(null, seasons.map(function (s) { return Math.abs(s.avgChangePct); }).concat([1]));
    var html = '';
    seasons.forEach(function (s) {
      var w = Math.round(Math.abs(s.avgChangePct) / maxV * 100);
      var cls = s.avgChangePct >= 0 ? 'up' : 'down';
      html += '<div class="season-row"><div class="season-name">' + s.name + '</div>' +
        '<div class="season-bar"><div class="season-fill ' + cls + '" style="width:' + w + '%"></div></div>' +
        '<div class="season-val"><span class="' + dirClass(s.avgChangePct) + '">' + faPct(s.avgChangePct) + '</span> · ' +
        'میانگین ' + fa(s.years) + ' سال</div></div>';
    });
    el('seasonal').innerHTML = html || '<p>داده‌ای نیست.</p>';
  }
})();
