<div dir="rtl" align="center">

# 📊 چقدر؟ — داشبورد طلا و ارز

**داشبورد فارسی قیمت زنده و تاریخچه دلار، طلا، سکه و تتر**

[![Live Prices](https://github.com/mewshiam/Cheghadr-Dashboard/actions/workflows/update-telegram.yml/badge.svg)](https://github.com/mewshiam/Cheghadr-Dashboard/actions/workflows/update-telegram.yml)
[![TGJU Update](https://github.com/mewshiam/Cheghadr-Dashboard/actions/workflows/update-data.yml/badge.svg)](https://github.com/mewshiam/Cheghadr-Dashboard/actions/workflows/update-data.yml)
[![Daily Rebuild](https://github.com/mewshiam/Cheghadr-Dashboard/actions/workflows/daily-rebuild.yml/badge.svg)](https://github.com/mewshiam/Cheghadr-Dashboard/actions/workflows/daily-rebuild.yml)

[🌐 مشاهده داشبورد](https://cheghadr-dashboard.pages.dev) · [📖 مستندات](#-مستندات) · [🚀 استقرار](#-استقرار-روی-cloudflare-pages)

</div>

---

## ✨ ویژگی‌ها

| ویژگی | توضیح |
|-------|-------|
| 💵 قیمت زنده | دلار و تتر از کانال‌های تلگرام، طلا و سکه از tgju.org |
| 📈 تاریخچه ۱۰ ساله | بیش از ۲۰٬۰۰۰ رکورد روزانه از ۱۳۹۵ |
| 🪙 تحلیل حباب سکه | ارزش ذاتی، درصد حباب و نمودار تاریخی برای هر سکه |
| 🌍 انس طلا | آمار شمسی و میلادی با سوییچ تقویم |
| 📊 تحلیل فصلی | بهترین/بدترین ماه‌ها و فصل‌ها برای هر دارایی |
| 🎨 تم اختصاصی | هر دارایی رنگ خودش را دارد |
| 📱 ریسپانسیو | موبایل و دسکتاپ، حالت روشن/تیره خودکار |

## 🗂 ساختار پروژه

```
├── index.html              # صفحه اصلی
├── css/style.css           # استایل‌ها و تم‌ها
├── js/app.js               # منطق داشبورد (بدون وابستگی)
├── data/
│   └── dashboard_data.json # داده‌ها (خودکار به‌روز می‌شود)
├── build_data.py           # اسکریپت جمع‌آوری داده
├── build_bubble.py         # محاسبه حباب سکه‌ها
├── build_ons.py            # داده انس طلا
└── .github/workflows/      # اتوماسیون به‌روزرسانی
    ├── update-telegram.yml # تلگرام: هر ۱ ساعت
    ├── update-data.yml     # tgju: هر ۲ ساعت
    └── daily-rebuild.yml   # بازسازی کامل: روزانه
```

## 📖 مستندات

- [منابع داده](docs/DATA_SOURCES.md) — تلگرام، tgju.org و فرمول‌ها
- [فرکانس به‌روزرسانی](docs/UPDATE_SCHEDULE.md) — زمان‌بندی ورک‌فلوها
- [توسعه محلی](docs/DEVELOPMENT.md) — اجرای لوکال و تغییر تم

## 🚀 استقرار روی Cloudflare Pages

۱. این ریپو را Fork کنید
۲. در داشبورد Cloudflare: **Pages** → **Create** → **Connect to Git**
۳. ریپو را انتخاب کنید — Build command خالی، output روی `/`
۴. Deploy ✅

دیتا از خود ریپو (raw.githubusercontent) خوانده می‌شود — آپدیت دیتا **بدون ری‌دیپلوی** انجام می‌شود.

## 📄 لایسنس

MIT — آزاد برای استفاده شخصی و تجاری.
</div>
