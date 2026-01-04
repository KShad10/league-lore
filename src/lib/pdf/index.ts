/**
 * PDF Export Utilities
 * 
 * Browser-based PDF export using native print dialog.
 * This approach works on Vercel without Puppeteer dependencies.
 * 
 * Usage:
 * - For iframe content: printIframe(iframeRef)
 * - For HTML string: printHtml(htmlContent, title)
 */

/**
 * Print the content of an iframe element
 * Opens the print dialog for the iframe's document
 */
export function printIframe(iframe: HTMLIFrameElement): void {
  const iframeWindow = iframe.contentWindow;
  if (!iframeWindow) {
    console.error('Cannot access iframe content window');
    return;
  }
  
  iframeWindow.focus();
  iframeWindow.print();
}

/**
 * Print HTML content by opening it in a new window
 * Useful when you have raw HTML string to print
 */
export function printHtml(html: string, title: string = 'Report'): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Failed to open print window. Check popup blocker.');
    return;
  }
  
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;
  
  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Optional: close after print dialog
    // printWindow.onafterprint = () => printWindow.close();
  };
}

/**
 * Export report by fetching HTML and triggering print
 * @param reportUrl - URL to fetch HTML report from
 */
export async function exportReportAsPdf(reportUrl: string): Promise<void> {
  try {
    const response = await fetch(reportUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.statusText}`);
    }
    
    const html = await response.text();
    const title = extractTitleFromHtml(html) || 'League Report';
    printHtml(html, title);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw error;
  }
}

/**
 * Extract title from HTML document
 */
function extractTitleFromHtml(html: string): string | null {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : null;
}

/**
 * Print styles that enhance PDF output
 * Include this in your report's <style> section
 */
export const pdfPrintStyles = `
  @page {
    size: letter;
    margin: 0.5in;
  }
  
  @media print {
    /* Force background colors and images */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    /* Reset body for print */
    body {
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    
    /* Page break utilities */
    .page-break-before {
      page-break-before: always;
    }
    
    .page-break-after {
      page-break-after: always;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    .no-break,
    .avoid-break {
      page-break-inside: avoid;
    }
    
    /* Keep headers with content */
    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
    }
    
    /* Keep tables together when possible */
    table, figure, img {
      page-break-inside: avoid;
    }
    
    /* Hide elements not meant for print */
    .no-print,
    .screen-only {
      display: none !important;
    }
    
    /* Ensure links show URL in print (optional) */
    a[href]:after {
      content: none; /* Remove if you want URLs printed */
    }
    
    /* Fix for some browsers cutting off content */
    .report-container {
      max-width: none !important;
      width: 100% !important;
    }
  }
`;

/**
 * Configuration for PDF page sizes
 */
export const pageConfig = {
  letter: {
    width: '8.5in',
    height: '11in',
    margin: '0.5in',
  },
  a4: {
    width: '210mm',
    height: '297mm',
    margin: '12.7mm',
  },
};

export default {
  printIframe,
  printHtml,
  exportReportAsPdf,
  pdfPrintStyles,
  pageConfig,
};
