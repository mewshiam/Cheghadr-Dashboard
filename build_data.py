#!/usr/bin/env python3
"""Build dashboard_data.json for all assets from tgju.org API.

Assets: dollar, gold18, sekee, sekeb, nim, rob, gerami, tether
Live prices: dollar & tether from Telegram channels (5-sample daily average),
             others from tgju.org main page.
Output: ~/workspace/dollar-dashboard/dashboard_data.json
"""
import json, re, urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

JALALI_NAMES = {1:'فروردین',2:'اردیبهشت',3:'خرداد',4:'تیر',5:'مرداد',6:'شهریور',
                7:'مهر',8:'آبان',9:'آذر',10:'دی',11:'بهمن',12:'اسفند'}

ASSETS = {
    'dollar':  {'symbol': 'price_dollar_rl', 'name': 'دلار آمریکا',    'unit': 'تومان'},
    'gold18':  {'symbol': 'geram18',         'name': 'طلای ۱۸ عیار',   'unit': 'تومان / گرم'},
    'sekee':   {'symbol': 'sekee',           'name': 'سکه امامی',       'unit': 'تومان'},
    'sekeb':   {'symbol': 'sekeb',           'name': 'سکه بهار آزادی',  'unit': 'تومان'},
    'nim':     {'symbol': 'nim',             'name': 'نیم سکه',         'unit': 'تومان'},
    'rob':     {'symbol': 'rob',             'name': 'ربع سکه',        'unit': 'تومان'},
    'gerami':  {'symbol': 'gerami',          'name': 'سکه گرمی',       'unit': 'تومان'},
    'tether':  {'symbol': 'crypto-tether-irr','name': 'تتر',            'unit': 'تومان'},
    'oil_brent': {'symbol': 'oil_brent',      'name': 'نفت برنت',        'unit': 'دلار', 'usd': True},
    'oil_opec':  {'symbol': 'oil_opec',       'name': 'نفت اوپک',        'unit': 'دلار', 'usd': True},
}
API_TMPL = 'https://api.tgju.org/v1/market/indicator/summary-table-data/{symbol}'
import os
DATA_PATH = os.environ.get('DASHBOARD_DATA_PATH', '/home/hatch/workspace/dollar-dashboard/dashboard_data.json')
MIN_YEAR = 1395  # 10-year window like the dollar dashboard

def num(s):
    return int(re.sub(r'[^\d]', '', s))

def fetch(symbol):
    req = urllib.request.Request(API_TMPL.format(symbol=symbol), headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.tgju.org/'})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)['data']

def build_asset(symbol, usd=False):
    days = []
    for row in fetch(symbol):
        jy, jm, jd = map(int, row[7].split('/'))
        if jy < MIN_YEAR:
            continue
        if usd:
            p = round(float(re.sub(r'[^\d.]', '', str(row[3]))), 2)  # USD, keep decimals
        else:
            p = num(row[3]) // 10  # rial -> toman
        if p > 0:
            days.append((jy, jm, jd, p))
    days.sort()
    # dedupe same day (keep last)
    seen = {}
    for y, m, dd, p in days:
        seen[(y, m, dd)] = p
    days = [(y, m, dd, p) for (y, m, dd), p in sorted(seen.items())]

    daily = [{'d': f'{y}/{m:02d}/{dd:02d}', 'p': p} for y, m, dd, p in days]

    mon = defaultdict(list)
    for y, m, dd, p in days:
        mon[(y, m)].append((dd, p))
    mkeys = sorted(mon)

    monthly, prev_avg = [], None
    for (y, m) in mkeys:
        pts = sorted(mon[(y, m)])
        avg = sum(p for _, p in pts) / len(pts)
        chg = (avg - prev_avg) / prev_avg * 100 if prev_avg else 0
        monthly.append({'y': y, 'm': m, 'name': JALALI_NAMES[m], 'avg': round(avg),
                        'open': pts[0][1], 'close': pts[-1][1],
                        'changePct': round(chg, 2), 'days': len(pts)})
        prev_avg = avg

    weeks, prev_close = [], None
    for (y, m) in mkeys:
        pts = sorted(mon[(y, m)])
        maxd = max(dd for dd, _ in pts)
        for wi, (s, e) in enumerate([(1,7),(8,14),(15,21),(22,28),(29,maxd)], 1):
            wpts = [(dd, p) for dd, p in pts if s <= dd <= e]
            if not wpts:
                continue
            avg = sum(p for _, p in wpts) / len(wpts)
            chg = (avg - prev_close) / prev_close * 100 if prev_close else 0
            weeks.append({'y': y, 'm': m, 'w': wi, 'range': f'{s} تا {e}',
                          'avg': round(avg), 'changePct': round(chg, 2)})
            prev_close = avg

    avgs = {k: sum(p for _, p in v)/len(v) for k, v in mon.items()}
    mom = {}
    for i, (y, m) in enumerate(mkeys):
        if i == 0:
            continue
        py, pm = mkeys[i-1]
        exp = (y, m-1) if m > 1 else (y-1, 12)
        if (py, pm) != exp:
            continue
        mom[(y, m)] = (avgs[(y, m)] - avgs[(py, pm)]) / avgs[(py, pm)] * 100

    by_month = defaultdict(list)
    for (y, m), v in mom.items():
        by_month[m].append((y, round(v, 2)))
    for m in by_month:
        by_month[m].sort()

    seasonal = []
    for m in range(1, 13):
        vals = [v for _, v in by_month[m]]
        avg = sum(vals)/len(vals) if vals else 0
        pos = sum(1 for v in vals if v > 0)
        seasonal.append({'m': m, 'name': JALALI_NAMES[m],
                         'avgChangePct': round(avg, 2),
                         'upYears': pos, 'totalYears': len(vals)})

    ranked = sorted(by_month.items(),
                    key=lambda kv: sum(v for _, v in kv[1])/len(kv[1]),
                    reverse=True)
    top5 = [{'m': m, 'name': JALALI_NAMES[m],
             'avgChangePct': round(sum(v for _, v in vals)/len(vals), 2),
             'years': [{'y': y, 'pct': v} for y, v in vals]}
            for m, vals in ranked[:5]]

    return {'daily': daily, 'monthly': monthly, 'weekly': weeks,
            'seasonal': seasonal, 'top5months': top5,
            'years': sorted(set(y for y, _, _, _ in days))}

def jalali_plus_one(y, m, d):
    """Add one day to a Jalali date."""
    dim = 31 if m <= 6 else (30 if m <= 11 else 29)
    # leap years: 1403 was leap; 1408 next. 1405 not leap.
    d += 1
    if d > dim:
        d, m = 1, m + 1
        if m > 12:
            m, y = 1, y + 1
    return y, m, d

def jalali_minus_one(y, m, d):
    """Subtract one day from a Jalali date."""
    d -= 1
    if d < 1:
        m -= 1
        if m < 1:
            m, y = 12, y - 1
        d = 31 if m <= 6 else (30 if m <= 11 else 29)
    return y, m, d

JALALI_MONTH_NUM = {v: k for k, v in JALALI_NAMES.items()}

def resolve_live_date(stamp, today_j):
    """Turn tgju's 5th-cell stamp into a Jalali date string.

    The stamp is usually a clock time on open market days, but on closed
    days tgju reports the last update's date instead (e.g. '۲۳ مهر') or
    'امروز'/'دیروز'. When the stamp itself carries a date, use it for the
    live `date` field rather than the jalali_plus_one(today) heuristic, so
    the card never claims an update happened today when the price is from
    an earlier day. `today_j` is the 'y/mm/dd' heuristic fallback.
    """
    ty, tm, td = map(int, today_j.split('/'))
    s = (stamp or '').strip()
    if not s:
        return today_j
    if re.fullmatch(r'[۰-۹0-9]{1,2}:[۰-۹0-9]{2}(:[۰-۹0-9]{2})?', s) or s == 'امروز':
        return today_j
    if s == 'دیروز':
        y, m, d = jalali_minus_one(ty, tm, td)
        return f'{y}/{m:02d}/{d:02d}'
    dm = re.fullmatch(r'([۰-۹0-9]+)\s+(\S+)', s)
    if dm:
        try:
            d = int(dm.group(1))
        except ValueError:
            return today_j
        mon = JALALI_MONTH_NUM.get(dm.group(2))
        if d and mon:
            y = ty - 1 if (mon, d) > (tm, td) else ty
            return f'{y}/{mon:02d}/{d:02d}'
    return today_j

TEHRAN_TZ = timezone(timedelta(hours=3, minutes=30))
# Telegram live sources: channel URL per asset key
TELEGRAM_CHANNELS = {
    'dollar': 'https://t.me/s/dollar_tehran3bze',
    'tether': 'https://t.me/s/IRR_Tether',
}
# 5 key intraday sample times (Tehran) for the daily average
TELEGRAM_SAMPLE_HOURS = [10, 13, 16, 19, 22]

def _fetch_channel_html(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', errors='ignore')

def _parse_channel_messages(html):
    """Returns [(datetime_tehran, text)] newest-last."""
    msgs = re.findall(
        r'<div class="tgme_widget_message_wrap[^"]*"[^>]*>.*?<time datetime="([^"]+)"[^>]*>'
        r'.*?</time>.*?<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', html, re.S)
    out = []
    for dt_raw, txt_html in msgs:
        txt = re.sub(r'<[^>]+>', '', txt_html).strip().replace('ـ', '')
        try:
            dt = datetime.fromisoformat(dt_raw.replace('Z', '+00:00')).astimezone(TEHRAN_TZ)
        except ValueError:
            continue
        out.append((dt, txt))
    return out

def _extract_tg_price(asset_key, txt):
    """Returns (kind, price_toman) or (None, None).
    Dollar kinds: naghdi_* (cash), fardaei_* (futures), summary_last."""
    if asset_key == 'dollar':
        if 'پایان معاملات' in txt:
            m = re.search(r'آخرین معامله\s*:?\s*`?([\d,]+)`?', txt)
            return ('summary_last', int(m.group(1).replace(',', ''))) if m else (None, None)
        is_naghdi = 'دلار نقدی' in txt
        is_fardaei = 'دلار فردایی' in txt
        if (is_naghdi or is_fardaei) and ('فروش' in txt or 'خرید' in txt or 'معامله شد' in txt):
            m = re.search(r'([\d,]{5,})', txt)
            if m:
                side = 'sell' if 'فروش' in txt else ('buy' if 'خرید' in txt else 'traded')
                kind = ('naghdi_' if is_naghdi else 'fardaei_') + side
                return (kind, int(m.group(1).replace(',', '')))
    elif asset_key == 'tether':
        m = re.search(r'تتر\s*\(USDT\):\s*`?([\d,]+)`?', txt)
        if m:
            return ('tick', int(m.group(1).replace(',', '')))
    return (None, None)

def fetch_telegram_live():
    """5-sample daily average from Telegram channels.

    For each asset: take price messages from today (Tehran), pick the one
    nearest each of TELEGRAM_SAMPLE_HOURS, average them -> today's price.
    Falls back to the latest available sample when today has none.
    Returns {asset_key: {'price', 'samples', 'time', 'date_j', 'source'}}.
    """
    result = {}
    today = datetime.now(TEHRAN_TZ).date()
    for key, url in TELEGRAM_CHANNELS.items():
        try:
            html = _fetch_channel_html(url)
        except Exception:
            continue
        samples = []  # (datetime, price, kind)
        for dt, txt in _parse_channel_messages(html):
            kind, price = _extract_tg_price(key, txt)
            if price:
                samples.append((dt, price, kind))
        if not samples:
            continue
        if key == 'dollar':
            result[key] = _dollar_telegram_summary(samples, today)
            continue
        todays = [(dt, p) for dt, p, k in samples if dt.date() == today and k != 'summary_last']
        picked = []
        if todays:
            for h in TELEGRAM_SAMPLE_HOURS:
                target = datetime(today.year, today.month, today.day, h, 0, tzinfo=TEHRAN_TZ)
                best = min(todays, key=lambda x: abs((x[0] - target).total_seconds()))
                if best not in picked:
                    picked.append(best)
            # main price = latest tick; day average = mean of ALL today's posts
            latest_dt, latest_price = max(todays, key=lambda x: x[0])
            avg_price = round(sum(p for _, p in todays) / len(todays))
            price, price_label = latest_price, 'latest'
        else:
            # no samples today: use latest available (e.g. yesterday's summary)
            latest_dt, price, _ = max(samples, key=lambda x: x[0])
            avg_price = None
            picked = [(latest_dt, price)]
        jy, jm, jd = _gregorian_to_jalali(latest_dt.year, latest_dt.month, latest_dt.day)
        result[key] = {
            'price': price,          # latest tick (main display)
            'avg_price': avg_price,  # day's average (secondary display)
            'samples': len(picked),
            'time': latest_dt.strftime('%H:%M'),
            'date_j': f'{jy}/{jm:02d}/{jd:02d}',
            'source': 'telegram',
        }
    return result

def _dollar_telegram_summary(samples, today):
    """3-part dollar: naghdi (cash) latest, fardaei (futures) latest,
    avg_naghdi (average of today's cash posts)."""
    todays = [(dt, p, k) for dt, p, k in samples if dt.date() == today and k != 'summary_last']
    naghdi_today = [(dt, p) for dt, p, k in todays if k.startswith('naghdi_')]
    fardaei_today = [(dt, p) for dt, p, k in todays if k.startswith('fardaei_')]

    def latest(lst):
        return max(lst, key=lambda x: x[0]) if lst else (None, None)

    naghdi_dt, naghdi_price = latest(naghdi_today)
    fardaei_dt, fardaei_price = latest(fardaei_today)

    # fallback to latest available sample of each type (any day)
    if naghdi_price is None:
        cands = [(dt, p) for dt, p, k in samples if k.startswith('naghdi_')]
        naghdi_dt, naghdi_price = latest(cands)
    if fardaei_price is None:
        cands = [(dt, p) for dt, p, k in samples if k.startswith('fardaei_')]
        fardaei_dt, fardaei_price = latest(cands)
    # ultimate fallback: any latest sample
    if naghdi_price is None and fardaei_price is None:
        latest_dt, price, _ = max(samples, key=lambda x: x[0])
        naghdi_dt, naghdi_price = latest_dt, price

    avg_naghdi = round(sum(p for _, p in naghdi_today) / len(naghdi_today)) if naghdi_today else None

    # main price prefers naghdi (cash), falls back to fardaei
    main_price = naghdi_price if naghdi_price is not None else fardaei_price
    main_dt = naghdi_dt if naghdi_price is not None else fardaei_dt

    ref_dt = main_dt
    jy, jm, jd = _gregorian_to_jalali(ref_dt.year, ref_dt.month, ref_dt.day)
    out = {
        'price': main_price,         # main: cash preferred, futures fallback
        'price_naghdi': naghdi_price,
        'price_fardaei': fardaei_price,
        'avg_naghdi': avg_naghdi,    # average of today's cash posts
        'samples': len(naghdi_today) + len(fardaei_today),
        'time': ref_dt.strftime('%H:%M'),
        'date_j': f'{jy}/{jm:02d}/{jd:02d}',
        'source': 'telegram',
    }
    # keep legacy avg_price as day's cash average for compatibility
    out['avg_price'] = avg_naghdi
    return out

def _gregorian_to_jalali(gy, gm, gd):
    """Jalaali algorithm -> (jy, jm, jd)."""
    def div(a, b): return int(a / b)
    def mod(a, b): return a - int(a / b) * b
    breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635,
              2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
    def jal_cal(jy):
        leap_j = -14; jp = breaks[0]; jump = 0
        for i in range(1, len(breaks)):
            jm_ = breaks[i]; jump = jm_ - jp
            if jy < jm_: break
            leap_j += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm_
        n = jy - jp
        leap_j += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
        if mod(jump, 33) == 4 and jump - n == 4: leap_j += 1
        gy2 = jy + 621
        leap_g = div(gy2, 4) - div((div(gy2, 100) + 1) * 3, 4) - 150
        march = 20 + leap_j - leap_g
        return march
    def g2d(gy_, gm_, gd_):
        d = div((gy_ + div(gm_ - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm_ + 9, 12) + 2, 5) + gd_ - 34840408
        return d - div(div(gy_ + 100100 + div(gm_ - 8, 6), 100) * 3, 4) + 752
    def d2j(jdn):
        j = 4 * jdn + 139361631
        j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
        i = div(mod(j, 1461), 4) * 5 + 308
        gm2 = mod(div(i, 153), 12) + 1
        gy2 = div(j, 1461) - 100100 + div(8 - gm2, 6)
        jy = gy2 - 621
        jdn1f = g2d(gy2, 3, jal_cal(jy))
        jd_ = jdn - jdn1f
        if jd_ < 0:
            jy -= 1
            jdn1f = g2d(gy2 - 1, 3, jal_cal(jy))
            jd_ = jdn - jdn1f
        if jd_ <= 185:
            jm_ = 1 + div(jd_, 31); jd_ = mod(jd_, 31) + 1
        else:
            jd_ -= 186; jm_ = 7 + div(jd_, 30); jd_ = mod(jd_, 30) + 1
        return (jy, jm_, jd_)
    return d2j(g2d(gy, gm, gd))

def fetch_live(latest_daily, prev_closes=None, only=None):
    """Live prices. Dollar & tether prefer Telegram channels (5-sample daily
    average); others scraped from tgju.org main page. Returns dict key->info.
    only='telegram' skips tgju; only='tgju' skips Telegram."""
    prev_closes = prev_closes or {}
    live = {}
    # --- Telegram first (dollar, tether) ---
    tg = {}
    if only in (None, 'telegram'):
        try:
            tg = fetch_telegram_live()
        except Exception as e:
            print('telegram live failed:', e)
    for key, info in tg.items():
        prev = prev_closes.get(key)
        chg = round((info['price'] - prev) / prev * 100, 2) if prev else 0.0
        entry = {'price': info['price'], 'changePct': chg,
                 'time': info['time'], 'date': info['date_j'],
                 'source': 'telegram', 'samples': info['samples'],
                 'avg_price': info.get('avg_price')}
        # dollar 3-part: naghdi / fardaei / avg_naghdi
        for f in ('price_naghdi', 'price_fardaei', 'avg_naghdi'):
            if f in info:
                entry[f] = info[f]
        live[key] = entry
    # --- tgju main page for the rest (and as fallback) ---
    # --- tgju main page for the rest (and as fallback) ---
    if only in (None, 'tgju'):
        live.update(_fetch_tgju_live(latest_daily, set(live)))
    return live

def _fetch_tgju_live(latest_daily, skip_keys):
    """Scrape tgju.org main page. skip_keys: already covered (e.g. by Telegram)."""
    req = urllib.request.Request('https://www.tgju.org/', headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        html = r.read().decode('utf-8', errors='ignore')
    live = {}
    ly, lm, ld = map(int, latest_daily.split('/'))
    ty, tm, td = jalali_plus_one(ly, lm, ld)
    today_j = f'{ty}/{tm:02d}/{td:02d}'
    for key, cfg in ASSETS.items():
        if key in skip_keys or key in live or key in TELEGRAM_CHANNELS:
            continue  # already covered by Telegram
        m = re.search(r'<tr[^>]*data-market-row="' + cfg['symbol'] + r'".*?</tr>',
                      html, re.S)
        if not m:
            continue
        tds = re.findall(r'<td[^>]*>(.*?)</td>', m.group(0), re.S)
        vals = [re.sub(r'<[^>]+>', '', td).strip() for td in tds[:5]]
        try:
            if cfg.get('usd'):
                price = round(float(vals[0].replace(',', '')), 2)  # USD, keep decimals
            else:
                price = num(vals[0]) // 10  # rial -> toman
        except (ValueError, IndexError):
            continue  # empty/unparseable cell (e.g. early-morning page) — keep old live value
        pctm = re.search(r'([\d.]+)%', vals[1])
        chg = float(pctm.group(1)) if pctm else 0.0
        cls = re.search(r'class=\\?"(high|low)', tds[1])
        if cls and cls.group(1) == 'low':
            chg = -chg
        live_time = vals[4] if len(vals) > 4 else ''
        live[key] = {'price': price, 'changePct': round(chg, 2),
                     'time': live_time, 'date': resolve_live_date(live_time, today_j) if live_time else today_j}
    # gold ounce (USD, keep decimals — do NOT divide by 10)
    m = re.search(r'<tr[^>]*data-market-row="ons".*?</tr>', html, re.S)
    if m:
        tds = re.findall(r'<td[^>]*>(.*?)</td>', m.group(0), re.S)
        vals = [re.sub(r'<[^>]+>', '', td).strip() for td in tds[:5]]
        try:
            oprice = float(vals[0].replace(',', ''))
        except ValueError:
            oprice = 0
        pctm = re.search(r'([\d.]+)%', vals[1])
        ochg = float(pctm.group(1)) if pctm else 0.0
        cls = re.search(r'class=\\?"(high|low)', tds[1])
        if cls and cls.group(1) == 'low':
            ochg = -ochg
        if oprice > 0:
            live['ons'] = {'price': round(oprice, 2), 'changePct': round(ochg, 2),
                           'time': vals[4], 'date': resolve_live_date(vals[4], today_j), 'unit': 'usd'}
    return live
def main():
    out = {'assets': {}, 'meta': {'source': 'tgju.org API (direct scrape)'}}
    latest = ''
    for key, cfg in ASSETS.items():
        print(f'building {key} ({cfg["name"]})...', flush=True)
        a = build_asset(cfg['symbol'], usd=cfg.get('usd', False))
        a['name'] = cfg['name']
        a['unit'] = cfg['unit']
        out['assets'][key] = a
        if a['daily'] and a['daily'][-1]['d'] > latest:
            latest = a['daily'][-1]['d']
        print(f'  {len(a["daily"])} days, {a["daily"][0]["d"]} -> {a["daily"][-1]["d"]}')
    try:
        prev_closes = {}
        for key, a in out['assets'].items():
            if len(a['daily']) >= 2:
                prev_closes[key] = a['daily'][-2]['p']
        out['live'] = fetch_live(latest, prev_closes)
        # preserve ALL old live entries when fresh fetch misses them (e.g. market closed)
        try:
            _old_live = json.load(open(DATA_PATH)).get('live', {})
            for _k, _v in _old_live.items():
                if _k not in out['live']:
                    out['live'][_k] = _v
        except Exception:
            pass
        # keep last-known 3-part dollar values from existing file when fresh lacks them
        try:
            old = json.load(open(DATA_PATH)).get('live', {}).get('dollar', {})
            if 'dollar' in out['live']:
                for f in ('price_naghdi', 'price_fardaei', 'avg_naghdi'):
                    if out['live']['dollar'].get(f) is None and old.get(f) is not None:
                        out['live']['dollar'][f] = old[f]
        except Exception:
            pass
        print('live:', {k: (v['price'], v['date'], v['time']) for k, v in out['live'].items()})
    except Exception as e:
        print('live scrape failed:', e)
        out['live'] = {}
    out['meta']['updated'] = latest
    out['meta']['count'] = sum(len(a['daily']) for a in out['assets'].values())
    json.dump(out, open(DATA_PATH, 'w'), ensure_ascii=False, separators=(',', ':'))
    import os
    print('written', os.path.getsize(DATA_PATH)//1024, 'KB')

if __name__ == '__main__':
    import sys
    if '--live-only' in sys.argv:
        # Fast mode: only refresh live prices, report if anything changed
        # --only=telegram|tgju limits to one source (merges, doesn't wipe others)
        only = None
        for a in sys.argv:
            if a.startswith('--only='):
                only = a.split('=', 1)[1]
        d = json.load(open(DATA_PATH))
        latest = d['meta']['updated']
        old_live = json.dumps(d.get('live', {}), sort_keys=True)
        try:
            prev_closes = {}
            for key, a in d['assets'].items():
                if len(a['daily']) >= 2:
                    prev_closes[key] = a['daily'][-2]['p']
            fresh = fetch_live(latest, prev_closes, only=only)
            # keep last-known 3-part dollar values when fresh data lacks them
            old_dollar = d.get('live', {}).get('dollar', {})
            if 'dollar' in fresh:
                for f in ('price_naghdi', 'price_fardaei', 'avg_naghdi'):
                    if fresh['dollar'].get(f) is None and old_dollar.get(f) is not None:
                        fresh['dollar'][f] = old_dollar[f]
            d.setdefault('live', {}).update(fresh)
        except Exception as e:
            print('live scrape failed:', e)
            sys.exit(1)
        new_live = json.dumps(d.get('live', {}), sort_keys=True)
        if new_live != old_live:
            json.dump(d, open(DATA_PATH, 'w'), ensure_ascii=False, separators=(',', ':'))
            print('CHANGED')
            for k, v in d['live'].items():
                print(f"  {k}: {v['price']} @ {v['time']}")
        else:
            print('UNCHANGED')
    else:
        main()
