"use client";

import { Download } from "lucide-react";

/**
 * One-click «Сохранить как PDF». Triggers the browser's native print
 * dialog with window.print() — Chrome/Safari/Firefox all offer "Save as
 * PDF" right there. No PDF libs needed, full Cyrillic support, and the
 * @media print CSS already shapes the layout.
 */
export function SavePdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-control bg-accent text-white text-[0.88rem] font-semibold hover:bg-accent-dark transition-colors"
    >
      <Download size={14} aria-hidden="true" />
      <span>Сохранить как PDF</span>
    </button>
  );
}
