const fs = require('fs');

let c = fs.readFileSync('app/dashboard/inventario/page.tsx', 'utf8');

// 1. Agregar import de codigoBarras
if (!c.includes('generarSvgCodigoBarras')) {
  c = c.replace(
    "import { QRCodeSVG } from 'qrcode.react';",
    "import { QRCodeSVG } from 'qrcode.react';\nimport { generarSvgCodigoBarras, generarDataUrlCodigoBarras } from '@/lib/codigoBarras';"
  );
}

// 2. Agregar Barcode a lucide-react si no está
if (!c.includes('Barcode,')) {
  c = c.replace('QrCode,', 'QrCode, Barcode,');
}

// 3. Agregar estado formatoCodigoEtiqueta
if (!c.includes('formatoCodigoEtiqueta')) {
  c = c.replace(
    "const [tipoImpresoraQR, setTipoImpresoraQR] = useState<TipoImpresoraQR>('termica');",
    "const [formatoCodigoEtiqueta, setFormatoCodigoEtiqueta] = useState<'barras' | 'qr'>('barras');\n  const [tipoImpresoraQR, setTipoImpresoraQR] = useState<TipoImpresoraQR>('termica');"
  );
}

fs.writeFileSync('app/dashboard/inventario/page.tsx', c, 'utf8');
console.log('Pass 1 complete');
