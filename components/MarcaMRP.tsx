/**
 * Marca de la aplicación: las capas de un pavimento vistas de canto. La superior, en amarillo
 * de señalización, es la que se ve; las de abajo, base y sub-base, la sostienen.
 */
export function MarcaMRP({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect x="5" y="7" width="22" height="5.5" rx="1.75" fill="var(--marca)" />
      <rect x="5" y="14" width="22" height="5.5" rx="1.75" fill="currentColor" opacity="0.85" />
      <rect x="5" y="21" width="22" height="5.5" rx="1.75" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
