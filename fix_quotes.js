const fs = require('fs');
const file = 'c:/Users/Asus/Documents/FYP/FYP/frontend/app/checkout/[orderId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\\`/g, '`');
fs.writeFileSync(file, content);
console.log('Fixed');
