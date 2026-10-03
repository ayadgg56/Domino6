# دومينو أونلاين

## تشغيل محلي
    npm install
    npm start        # ثم افتح http://localhost:3000

## النشر على Render (أو Railway / Fly.io)
1. ارفع هذا المجلد إلى مستودع GitHub.
2. في Render: New → Blueprint (يقرأ render.yaml) أو Web Service بالأمر `node server.js`.
3. لحفظ الحسابات بعد إعادة التشغيل: أضف Disk واضبط DATA_FILE=/data/data.json
   (بدونه تُمسح البيانات عند كل نشر).
4. افتح الرابط الذي يعطيك إياه Render — يعمل WebSocket تلقائيًا على https.

## الملفات
- server.js      السيرفر: ملفات ثابتة + WebSocket + قاعدة بيانات JSON + قواعد صلاحيات
- public/index.html  اللعبة
