// Color de identificación por persona: cada usuario recibe siempre el mismo color,
// calculado a partir de su id (o correo/nombre si aún no tiene id).
const PALETA = [
  { bg: '#ffe4e9', fg: '#be123c' },
  { bg: '#e0ecff', fg: '#1d4ed8' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#f3e8ff', fg: '#7e22ce' },
  { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#cffafe', fg: '#0e7490' },
  { bg: '#fef3c7', fg: '#a16207' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#e2e8f0', fg: '#334155' },
  { bg: '#ede9fe', fg: '#5b21b6' },
];

export function colorForUser(user) {
  const clave = String(user?.id ?? user?.correo ?? user?.nombre ?? 'usuario');
  let hash = 0;
  for (let i = 0; i < clave.length; i++) hash = (hash * 31 + clave.charCodeAt(i)) >>> 0;
  return PALETA[hash % PALETA.length];
}

export function initials(nombre) {
  return (nombre || 'U')
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
