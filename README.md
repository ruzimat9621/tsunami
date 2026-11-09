# Fason hisob ✂️

Kiyim ishlab chiqaruvchi uchun ilova: fason → bozordan material → sex (bichuv/tikuv) → tayyor tovar → sotuv → **toza foyda**.
Bitta kod: **web**da ishlaydi, **iPhone** va **Android**ga ilova sifatida o'rnatiladi (PWA), **internetsiz** ham ishlaydi.

## Ish tartibi (fason sahifasida)

1. **Rasvetkalar** — bir yo'la bir nechta rasm yuklanadi (9, 10, 12 ta...), har biriga rang nomi yoziladi.
2. **Har bir rasvetkaning o'z materiallari** — masalan Bardo: tepasi uchun bardoviy mato, ishtoni uchun choko, astar ("+ Material"). Narx **kg** yoki **metr**ga; kg bo'lsa **"1 kg da necha metr"** yoziladi. "⧉ Nusxa olish" — boshqa rasvetkaning materiallarini ko'chirib, faqat rang va miqdorni o'zgartirasiz. Hamma rasvetkaga bir xil narsalar (tugma, zamok) — **Umumiy** bo'limida.
3. **Aksessuar va detallar** — tugma, zamok, rezinka, lenta va h.k.
4. **Sarf kiyim qismlari bo'yicha** — masalan Tepa 1,7 m + Ishton 1 m (yoki To'liq 2,7 m). Ilova har bir materialdan **nechta chiqishini**, qancha ortishini va 1 donaga necha pul ketishini hisoblaydi. Eng kam chiqaradigan material — chiqadigan tovar soni.
5. **Sex** — manzil, tikuvchi ismi, telefon; kelishuv: usluga (to'liq), bichuv, tikuv yoki boshqa — 1 donaga narx. To'langan pul va qarz.
6. **Qo'shimcha harajatlar** — arava (bozordan chiqarish), taksi, yuk tashish va h.k. bir martalik summalar; tannarxga qo'shiladi.
7. **Qo'shimcha xizmatlar** — dazmol, upakovka, dostavka, print, vishivka, petlya va istalgan boshqasi (1 donaga yoki umumiy summa).
7. **Hisob** — chiqadigan tovar soni, **1 dona tannarxi**, **har bir rasvetka alohida** (nechta chiqadi, tannarx, foyda), hamma rasxodlar jadvali (1 donaga / jami).
8. **Sotuv narxi** — o'zingiz narx yozasiz yoki tannarx ustiga summa/foiz qo'yasiz → 1 donadan va jami **foyda**.
9. **Sexdan olingan tovar** va **sotuvlar** yoziladi — shundan keyin hisob haqiqiy son bo'yicha.

**Sex va tayyor qismlar:** har bir materialda **qaysi sexga berilgani** va **sex shundan nechta chiqarib bergani** yoziladi — shu son bo'yicha qoldiq material hisoblanadi. Qismlar alohida yig'iladi: masalan Tepa = choko 15 + bardo 17 + siniy 26 = 58, Ishton = 58 → **58 komplekt** (avtomatik, eng kam qism bo'yicha). Astar kabi **yordamchi** matolar qism soniga qo'shilmaydi. Aksessuar **pachka**da olinsa, "1 pachkada necha dona" yoziladi.

Hisob uchun son: sexdan olingan komplekt (qo'lda) → qismlardan avtomatik komplekt → reja → materialdan chiqadigan son. Sexga to'lov = shu son × kelishilgan narx.

Boshqa bo'limlar: **Do'konlar** (manzil, telefon, nima olingani), **Sexlar** (fasonlar, ish haqi, qarz), **Oylik** (ijara, ish haqi va boshqa oylik rasxodlar, **toza foyda = sotuvdan foyda − oylik rasxodlar**).

## Server (OVHcloud) — bir nechta telefonda birga ishlash

Ilova va ma'lumotlar sizning serveringizda turadi. Siz va oilangiz **bitta email/parol** bilan kirasiz — bir telefonda yozilgan narsa ikkinchisida 1 soniyada ko'rinadi. Internet bo'lmasa ham ishlaydi, internet kelganda o'zi yuboradi.

### O'rnatish (bir marta, ~5 daqiqa)
1. OVH serverga SSH orqali kiring (Ubuntu yoki Debian).
2. Quyidagi buyruqni ishga tushiring:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/ruzimat9621/tsunami/main/deploy/install.sh | sudo bash
   ```
   O'z domeningiz bo'lsa (masalan `fason.example.uz`, A-yozuvi server IP siga qaratilgan):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/ruzimat9621/tsunami/main/deploy/install.sh | sudo bash -s fason.example.uz
   ```
   Domen bo'lmasa — avtomatik `51-75-1-2.sslip.io` ko'rinishidagi manzil beriladi (bepul, HTTPS bilan).
3. Oxirida chiqqan **https://…** manzilni telefonda oching → ⚙︎ Sozlamalar → email va parol → **Ro'yxatdan o'tish** (faqat birinchi marta, faqat bitta hisob ochiladi).
4. Ayolingiz o'sha manzilni ochadi → ⚙︎ Sozlamalar → **o'sha** email va parol → **Kirish**. Keyin "Bosh ekranga qo'shish".

Avval telefonda kiritgan ma'lumotlaringiz birinchi kirishda serverga yuklanadi.

### Yangilash
Har safar yangi versiya chiqqanda serverda: `sudo bash /opt/fason-hisob/deploy/install.sh`

### Zaxira
Ma'lumotlar bazasi: `/opt/fason-hisob/data/fason.db`. Server har kuni zaxira oladi (`data/backups`, oxirgi 14 kun).

> OVH panelida "Network firewall" yoqilgan bo'lsa, 80 va 443 portlarini oching.

## Telefonga o'rnatish
1. Ilova manzilini oching (pastga qarang).
2. **iPhone (Safari):** "Ulashish" ⬆︎ → "Bosh ekranga qo'shish".
   **Android (Chrome):** ⋮ → "Ilovani o'rnatish".

## Joylash (bepul, GitHub Pages)
1. GitHub → **Settings → Pages → Source: Deploy from a branch**.
2. Branch: **main**, papka: **/ (root)** → **Save**.
3. 1–2 daqiqadan keyin ilova `https://<username>.github.io/<repo>/` manzilida ochiladi. `main` ga har bir o'zgarish avtomatik chiqadi.

> Eslatma: bepul rejada GitHub Pages faqat **public** repository uchun ishlaydi. Repo private bo'lsa — uni public qiling yoki Netlify / Cloudflare Pages / Vercel'ga papkani shundayicha yuklang (build kerak emas).

## Ma'lumotlar qayerda saqlanadi
Har bir telefonda (IndexedDB) nusxa bor — internetsiz ishlaydi. Serverga ulangan bo'lsa, server bilan sinxronlanadi.
Telefon almashtirish yoki boshqa qurilmaga o'tkazish uchun: **⚙︎ Sozlamalar → Faylga saqlash**, keyin yangi qurilmada **Fayldan yuklash**. Haftada bir marta zaxira olib qo'ying.


## Dasturchi uchun
Build talab qilinmaydi — oddiy HTML/CSS/JS (ES modules).
```bash
npm start   # faqat ilova: http://localhost:8080
npm run server   # ilova + server: http://localhost:8080
npm test    # hisob-kitob testlari
```
- `js/calc.js` — barcha hisob-kitoblar (testlangan)
- `js/store.js` — IndexedDB saqlash
- `js/sync-core.js`, `js/sync.js` — server bilan sinxronlash (o'zgargan yozuvlargina yuboriladi, jonli yangilanish SSE orqali)
- `server/server.js` — backend: ilova fayllari, SQLite, kirish, API (tashqi kutubxonasiz, Node.js 22.13+)
- `deploy/` — Docker Compose + Caddy (avtomatik HTTPS) va o'rnatish skripti
- `js/app.js` — interfeys
- `sw.js` — offline kesh (yangi versiyada `VERSION` ni oshiring)
