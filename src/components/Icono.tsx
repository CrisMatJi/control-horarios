const P: Record<string, string> = {
  escritorio: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  empleados: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  calendario: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  rotacion: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4',
  email: 'M4 6h16v12H4zM4 7l8 6 8-6',
  salir: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  papelera: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  editar: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  mas: 'M12 5v14M5 12h14',
  izq: 'M15 6l-6 6 6 6',
  der: 'M9 6l6 6-6 6',
  descargar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  subir: 'M12 15V3M7 8l5-5 5 5M4 15v5h16v-5',
  cerrar: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  alerta: 'M12 8v5M12 16.5v.5M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  restaurar: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

export function Icono({ n, t = 18, className }: { n: keyof typeof P | string; t?: number; className?: string }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={P[n] ?? ''} />
    </svg>
  );
}
