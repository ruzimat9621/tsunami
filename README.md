# Fason hisob ✂️

Kiyim ishlab chiqaruvchi uchun ilova: fason → bozordan material → sex (bichuv/tikuv) → tayyor tovar → sotuv → **toza foyda**.
Bitta kod: **web**da ishlaydi, **iPhone** va **Android**ga ilova sifatida o'rnatiladi (PWA), **internetsiz** ham ishlaydi.

## Nimalar bor

| Bo'lim | Nima qiladi |
|---|---|
| **Fasonlar** | Rasm, nom, kod, o'lcham, reja soni, holati. Har bir fasonning hamma rasxodi bitta sahifada. |
| **Material** | Qaysi do'kondan, nomi, rangi, metraj (yoki dona/kg), narxi, sanasi. **1 ta kiyimga sarfi** kiritilsa avtomatik: nechta chiqadi, qanchasi ishlatildi, qancha **ortib qoldi** yoki **yetishmaydi**. |
| **Boshqa rasxod** | Transport, qadoq, etiketka va h.k. — fasonga biriktiriladi. |
| **Sex** | Qaysi sex, bichuvchi va tikuvchi narxi (1 donaga) yoki **umumiy usluga**, to'langan pul va **qarz**. Sexdan olingan **tayyor tovar soni** (bir necha partiya). |
| **Hisob** | 1 dona **tannarx**, rasxodlar jadvali (1 donaga / jami), material qancha tovarga yetishi, ombor qoldig'i, ortgan material qiymati. |
| **Sotuv** | Marja (% yoki so'm) → sotuv narxi, 1 donadan foyda. Har bir sotuv/topshirish yoziladi, foyda avtomatik. |
| **Do'konlar** | Bozordagi do'konlar: bozor, manzil (blok/qator), telefon (bosib qo'ng'iroq qilish), shu do'kondan olingan hamma narsalar. |
| **Sexlar** | Manzil, telefon, shu sexdagi fasonlar, jami ish haqi va qarz. |
| **Oylik** | Ijara, ish haqi, transport kabi oylik rasxodlar; doimiy rasxodlarni bir tugma bilan oyga qo'shish. **Toza foyda = sotuvdan foyda − oylik rasxodlar.** |

### Hisob qanday qilinadi
- **Son:** sexdan tovar olinmaguncha — *reja* soni bo'yicha (taxminiy), olingandan keyin — *haqiqiy olingan son* bo'yicha.
- **Tannarx (1 dona)** = (material + sex + boshqa rasxodlar) ÷ son.
- **Sotuv narxi** = tannarx + marja.
- **Sotilganlardan foyda** = tushum − sotilgan dona × tannarx.
- **Oylik toza foyda** = shu oydagi sotuvlardan foyda − shu oyning oylik rasxodlari.

## Telefonga o'rnatish
1. Ilova manzilini oching (pastga qarang).
2. **iPhone (Safari):** "Ulashish" ⬆︎ → "Bosh ekranga qo'shish".
   **Android (Chrome):** ⋮ → "Ilovani o'rnatish".

## Joylash (bepul, GitHub Pages)
1. Ushbu o'zgarishlarni `main` branchga birlashtiring (merge).
2. GitHub → **Settings → Pages → Source: GitHub Actions**.
3. Bir necha daqiqadan keyin ilova `https://<username>.github.io/<repo>/` manzilida ochiladi.

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
