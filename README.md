# Fason hisob ✂️

Kiyim ishlab chiqaruvchi uchun ilova: fason → bozordan material → sex (bichuv/tikuv) → tayyor tovar → sotuv → **toza foyda**.
Bitta kod: **web**da ishlaydi, **iPhone** va **Android**ga ilova sifatida o'rnatiladi (PWA), **internetsiz** ham ishlaydi.

## Ish tartibi (fason sahifasida)

1. **Rasvetkalar** — bir yo'la bir nechta rasm yuklanadi (9, 10, 12 ta...), har biriga rang nomi yoziladi.
2. **Matolar** — nomi, rangi, narxi **kg** yoki **metr**ga, qaysi do'kondan. Kg bo'lsa "1 kg dan necha metr" ni yozsangiz, sarfni metrda kiritasiz.
3. **Aksessuar va detallar** — tugma, zamok, rezinka, lenta va h.k.
4. **Sarf kiyim qismlari bo'yicha** — masalan Tepa 1,7 m + Ishton 1 m (yoki To'liq 2,7 m). Ilova har bir materialdan **nechta chiqishini**, qancha ortishini va 1 donaga necha pul ketishini hisoblaydi. Eng kam chiqaradigan material — chiqadigan tovar soni.
5. **Sex** — manzil, tikuvchi ismi, telefon; kelishuv: usluga (to'liq), bichuv, tikuv yoki boshqa — 1 donaga narx. To'langan pul va qarz.
6. **Qo'shimcha xizmatlar** — dazmol, upakovka, dostavka, print, vishivka, petlya va istalgan boshqasi (1 donaga yoki umumiy summa).
7. **Hisob** — chiqadigan tovar soni, **1 dona tannarxi**, hamma rasxodlar jadvali (1 donaga / jami).
8. **Sotuv narxi** — o'zingiz narx yozasiz yoki tannarx ustiga summa/foiz qo'yasiz → 1 donadan va jami **foyda**.
9. **Sexdan olingan tovar** va **sotuvlar** yoziladi — shundan keyin hisob haqiqiy son bo'yicha.

Hisob uchun son: sexdan olingan son → bo'lmasa reja → bo'lmasa materialdan avtomatik chiqadigan son.

Boshqa bo'limlar: **Do'konlar** (manzil, telefon, nima olingani), **Sexlar** (fasonlar, ish haqi, qarz), **Oylik** (ijara, ish haqi va boshqa oylik rasxodlar, **toza foyda = sotuvdan foyda − oylik rasxodlar**).

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
Hamma ma'lumot **o'sha telefon/brauzerning o'zida** (IndexedDB) saqlanadi — server kerak emas, internetsiz ishlaydi.
Telefon almashtirish yoki boshqa qurilmaga o'tkazish uchun: **⚙︎ Sozlamalar → Faylga saqlash**, keyin yangi qurilmada **Fayldan yuklash**. Haftada bir marta zaxira olib qo'ying.

Keyingi bosqichda bir nechta qurilma (masalan, siz va yordamchingiz) bir vaqtda ishlashi uchun bulutli sinxronizatsiya (Supabase/Firebase) qo'shish mumkin.

## Dasturchi uchun
Build talab qilinmaydi — oddiy HTML/CSS/JS (ES modules).
```bash
npm start   # http://localhost:8080
npm test    # hisob-kitob testlari
```
- `js/calc.js` — barcha hisob-kitoblar (testlangan)
- `js/store.js` — IndexedDB saqlash
- `js/app.js` — interfeys
- `sw.js` — offline kesh (yangi versiyada `VERSION` ni oshiring)
