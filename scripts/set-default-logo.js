const fs = require('fs');
const path = require('path');
const prisma = require('../src/prisma');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 130" width="400" height="130">
  <rect width="400" height="130" fill="white"/>
  <g transform="translate(15, 10)">
    <path d="M45,5 L85,20 L85,65 C85,95 45,110 45,110 C45,110 5,95 5,65 L5,20 Z" fill="#0f172a" stroke="#000000" stroke-width="2"/>
    <path d="M22,65 Q30,45 45,45 Q60,45 68,65 L75,70 Q75,78 70,78 L65,78 Q65,72 58,72 Q51,72 51,78 L39,78 Q39,72 32,72 Q25,72 25,78 L20,78 Q15,78 15,70 Z" fill="#38bdf8"/>
    <path d="M45,18 L48,28 L58,31 L48,34 L45,44 L42,34 L32,31 L42,28 Z" fill="#f59e0b"/>
  </g>
  <text x="115" y="64" font-family="Arial, sans-serif" font-weight="900" font-size="50" fill="#0f172a" letter-spacing="1">DF <tspan fill="#0284c7">PRO</tspan></text>
  <text x="117" y="88" font-family="Arial, sans-serif" font-weight="800" font-size="13" fill="#334155" letter-spacing="3">CAR WASH &amp; DETAILING</text>
  <line x1="117" y1="98" x2="385" y2="98" stroke="#0284c7" stroke-width="3"/>
  <text x="117" y="114" font-family="Arial, sans-serif" font-weight="700" font-size="10" fill="#64748b" letter-spacing="2">STUDIO &amp; CERAMIC CENTER</text>
</svg>`;

const uploadDir = path.join(__dirname, '../uploads/branding');
fs.mkdirSync(uploadDir, { recursive: true });
fs.writeFileSync(path.join(uploadDir, 'df_pro_logo.svg'), svg);

const base64Logo = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

async function update() {
  const res = await prisma.businessBranding.updateMany({
    data: {
      logo_url: base64Logo,
      logo_size: 150,
    },
  });
  console.log('✔ Updated business branding with official DF PRO logo:', res);
}

update().catch(console.error).finally(() => prisma.$disconnect());
