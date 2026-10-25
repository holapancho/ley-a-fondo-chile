// Normaliza números de artículo para comparar: "18 QUÁTER", "18-quáter" y "18 quater" son lo mismo.
// La Ñ se conserva: el Código del Trabajo tiene arts. "183 N" y "183 Ñ" distintos.
export function normalizarNumero(s) {
  return String(s)
    .normalize('NFC').toLowerCase().replace(/ñ/g, '\u0001')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'ñ')
    .replace(/^\s*(articulo|art\.?)\s*/, '')
    .replace(/[º°ª]/g, '')
    .replace(/[.\-–]+\s*$/, '')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
