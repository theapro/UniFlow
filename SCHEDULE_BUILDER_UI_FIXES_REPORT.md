# Schedule Builder UI Fixes Report (2026-03-15)

Context: Admin panel schedule builder’da cohort ranglari bir xil chiqishi, Employability/Cowork cohort mosligi buzilishi, sidebar’dagi groups ro‘yxati juda uzun bo‘lib ketishi va Employability cohort-wide ekanligi UI’da to‘g‘ri ko‘rinmasligi muammolari bor edi.

## 1) Cohort ranglari bir xil bo‘lib qolishi

**Muammo**: IT cohort ranglari `sortOrder` orqali tanlanayotgani sabab (yoki ko‘p cohortlarda `sortOrder` bir xil/mavjud emasligi sabab) hammasi bir xil `--chart-*` rangga tushib qolishi mumkin edi.

**Yechim**:

- Rangni tanlashda `code` (cohort code) bo‘lsa, har doim `code`-hash asosida rang index tanlanadi.
- `code` bo‘lmasa, fallback sifatida `sortOrder` ishlatiladi.

**Fayl**:

- admin/components/schedule/builder/utils/cohortColors.ts

## 2) IT cohort ↔ Employability/Cowork cohort mosligi (xatolik 19/20/21 ostiga 23C tushib qolishi)

**Muammo**:

- Department row’ga group drop qilinganda cohort mosligi tekshirilmas edi.
- Employability/Cowork row cohort-wide bo‘lgani uchun, noto‘g‘ri cohort group qo‘yilib ketishi mumkin edi.

**Yechim**:

- Drag & drop’da group’ning `parentGroup.name` majburiy qilindi (yo‘q bo‘lsa drop bloklanadi).
- Employability/Cowork row’ga drop qilinsa:
  - Shu column’da IT group tanlangan bo‘lishi shart.
  - IT group cohort code va Employability group cohort code **teng** bo‘lishi shart.
  - Shu cohort’ga tegishli IT column span topilib, Employability assignment o‘sha span ichida faqat **1 marta** (span start position’da) saqlanadi.

**Fayl**:

- admin/components/schedule/builder/route/ScheduleBuilderProvider.tsx

## 3) Schedule sidebar: Groups’larni dropdown/collapsible qilish

**Talab**: “ScheduleSidebardagi guruhlarni dropdown bilan chiqadigan qilish kerak”.

**Yechim**:

- Groups bo‘limi departament bo‘yicha collapsible (dropdown-like) ko‘rinishga o‘tkazildi.
- IT / Partner / Employability / Language University ichida cohort’lar ham ichma-ich collapsible.
- Japanese bo‘limi ham collapsible (cohort bo‘yicha emas — oldingi logic saqlangan).

**Fayl**:

- admin/components/schedule/builder/ScheduleSidebar.tsx

## 4) Employability/Cowork cohort-wide ko‘rinishi (Group grid’da “span”)

**Talab**: IT cohort columns (masalan 23A, 23B, 23C, 23D) ostida bitta “Employability 23 …” ko‘rinishi.

**Yechim**:

- Department group grid’da faqat `Employability/Cowork` row uchun maxsus render qo‘shildi:
  - Adjacent IT columns bir xil cohort code bo‘lsa, ularni bitta “spanned” cell qilib ko‘rsatadi.
  - Spanned cell ichida o‘sha cohort uchun tanlangan Employability group name ko‘rsatiladi.
  - Remove (X) bosilganda — shu cohort span ichidagi Employability assignment’lar tozalab yuboriladi.

**Fayl**:

- admin/components/schedule/builder/ScheduleGrid.tsx

## 5) Auto add groups (avtomatik joylashtirish)

**Talab**: “Avtomatik ravishda butun guruhlarni joylashtiradigan function … Generate with ai functioniga o‘xshab”.

**Implemented (MVP / deterministic)**:

- Sidebar’da `Auto add groups` tugmasi qo‘shildi.
- U quyidagicha layout qiladi:
  - IT: cohort sortOrder / code bo‘yicha tartiblaydi va schedule column’larni IT’dan quradi.
  - Employability/Cowork: IT cohort span start position’iga mos cohort’ni qo‘yadi (cohort-wide rendering bilan mos).
  - Partner University / Language University: cohort code mos bo‘lsa, IT cohort span ichiga best-effort joylaydi.
  - Japanese: cohort bilan bog‘lanmagan holda, visible IT columns bo‘yicha ketma-ket joylaydi.

**Cheklov**:

- Hozircha bu action backend AI/Google tool chaqirmaydi (UI layout heuristics). Agar aynan AI+Google bilan “qoidalarni tushunib” layout qilish kerak bo‘lsa, backend endpoint (masalan `/api/admin/ai-groups/arrange`) qo‘shib, AI servis bilan JSON layout qaytarish dizaynini alohida qilish kerak bo‘ladi.

**Fayl**:

- admin/components/schedule/builder/ScheduleSidebar.tsx

## Qanday tekshirish (manual)

1. Admin panel → Schedule sahifasiga kiring.
2. IT column header’larda cohort ranglari turlicha chiqayotganini tekshiring.
3. Employability/Cowork row’ga noto‘g‘ri cohort group drop qilib ko‘ring → `Cohort mismatch` xabari chiqishi kerak.
4. 23A–23D kabi bir cohort’li IT columns bo‘lsa, Employability row’da bitta cell ko‘rinishida span bo‘lib turishi kerak.
5. Sidebar → Groups bo‘limida dept/cohort’lar collapsible bo‘lib ochilib-yopilishini tekshiring.
6. `Auto add groups` bosilganda IT tartibi to‘g‘ri tushishi va Employability cohort-wide mos qo‘yilishini tekshiring.
