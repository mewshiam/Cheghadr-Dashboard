/* داشبورد طلا و ارز — app logic (no dependencies) */
(function () {
  'use strict';

  var DATA_URL = 'data/dashboard_data.json';
  var ASSET_ORDER = ['dollar', 'gold18', 'sekee', 'sekeb', 'nim', 'rob', 'gerami', 'tether'];
  var state = { data: null, asset: 'dollar' };

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

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    fetch(DATA_URL)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
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
  }

  function selectAsset(key) {
    state.asset = key;
    document.body.dataset.asset = key;
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.asset === key); });
    var asset = state.data.assets[key];
    var live = state.data.live[key];
    renderLive(asset, live);
    drawChart(asset);
    renderMonthGrid(asset);
    renderWeekly(asset);
    renderCompare(asset);
    renderTop5(asset);
    renderSeasonal(asset);
    var active = document.querySelector('.tab.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

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
    html += '<div class="live-price">' + fa(live.price) + ' <span class="unit">' + asset.unit + '</span></div>';
    if (live.avg_price !== null && live.avg_price !== undefined) {
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

    // year ticks on x-axis
    ctx.fillStyle = muted; ctx.textAlign = 'center';
    var seenYears = {};
    for (var k = 0; k < data.length; k += Math.max(1, Math.floor(data.length / 8))) {
      var y = data[k].d.split('/')[0];
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
      var y = parseInt(daily[i].d.split('/')[0], 10);
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
})();
