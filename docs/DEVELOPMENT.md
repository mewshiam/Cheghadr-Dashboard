<div dir="rtl">

# 🛠 توسعه محلی

## اجرای لوکال

```bash
# روش ۱: سرور ساده پایتون
python3 -m http.server 8000
# باز کن: http://localhost:8000

# روش ۲: با دیتای تازه
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py --live-only
```

## به‌روزرسانی دستی دیتا

```bash
# فقط قیمت زنده
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py --live-only

# فقط تلگرام (دلار، تتر)
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py --live-only --only=telegram

# فقط tgju (طلا، سکه‌ها)
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py --live-only --only=tgju

# بازسازی کامل تاریخچه
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_data.py

# حباب سکه‌ها و انس (بعد از بازسازی کامل)
DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_bubble.py
pip install jdatetime && DASHBOARD_DATA_PATH=data/dashboard_data.json python3 build_ons.py
```

## تغییر تم یک دارایی

در `css/style.css` متغیرهای `:root` و `body[data-asset="..."]` را ویرایش کنید:

```css
body[data-asset="tether"] {
  --accent: #0b7a6c;
  --accent-light: #3fd9bd;
}
```

## افزودن دارایی جدید

۱. در `build_data.py` به دیکشنری `ASSETS` اضافه کنید
۲. در `js/app.js` به `ASSET_ORDER` اضافه کنید
۳. تم را در `css/style.css` تعریف کنید

</div>
