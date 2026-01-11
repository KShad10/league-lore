/**
 * Server-Side PDF Generation with Puppeteer
 *
 * This module provides true PDF generation using headless Chrome via Puppeteer.
 * Use this for server-side PDF generation (API routes, background jobs).
 *
 * For client-side export, use the browser-based utilities in ./index.ts
 */

import type { PDFOptions, Browser, Page } from 'puppeteer';

// Lazy-load puppeteer to avoid issues in browser environments
async function getPuppeteer() {
  const puppeteer = await import('puppeteer');
  return puppeteer.default;
}

/**
 * PDF generation options
 */
export interface PdfGenerationOptions {
  /** Page format (default: 'letter') */
  format?: 'letter' | 'a4';
  /** Print background colors and images (default: true) */
  printBackground?: boolean;
  /** Page margins */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  /** Scale factor (0.1 - 2.0, default: 1) */
  scale?: number;
  /** Generate landscape orientation (default: false) */
  landscape?: boolean;
  /** Header HTML template */
  headerTemplate?: string;
  /** Footer HTML template */
  footerTemplate?: string;
  /** Display header and footer (default: false) */
  displayHeaderFooter?: boolean;
  /** Preferred color scheme (default: 'light') */
  preferredColorScheme?: 'light' | 'dark';
}

/**
 * Default PDF options optimized for league reports
 */
const DEFAULT_PDF_OPTIONS: PdfGenerationOptions = {
  format: 'letter',
  printBackground: true,
  margin: {
    top: '0.5in',
    right: '0.7in',
    bottom: '0.8in',
    left: '0.7in',
  },
  scale: 1,
  landscape: false,
  displayHeaderFooter: false,
  preferredColorScheme: 'light',
};

/**
 * Browser instance cache for reuse
 */
let browserInstance: Browser | null = null;

/**
 * Get or create a browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const puppeteer = await getPuppeteer();

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  });

  return browserInstance;
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Generate PDF from HTML string
 *
 * @param html - Complete HTML document string
 * @param options - PDF generation options
 * @returns PDF as Uint8Array buffer
 */
export async function generatePdfFromHtml(
  html: string,
  options: PdfGenerationOptions = {}
): Promise<Uint8Array> {
  const mergedOptions = { ...DEFAULT_PDF_OPTIONS, ...options };
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();

    // Set preferred color scheme
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: mergedOptions.preferredColorScheme || 'light' },
    ]);

    // Set content
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
    });

    // Wait for any web fonts to load
    await page.evaluateHandle('document.fonts.ready');

    // Build PDF options
    const pdfOptions: PDFOptions = {
      format: mergedOptions.format === 'a4' ? 'A4' : 'Letter',
      printBackground: mergedOptions.printBackground,
      margin: mergedOptions.margin,
      scale: mergedOptions.scale,
      landscape: mergedOptions.landscape,
      displayHeaderFooter: mergedOptions.displayHeaderFooter,
    };

    if (mergedOptions.displayHeaderFooter) {
      if (mergedOptions.headerTemplate) {
        pdfOptions.headerTemplate = mergedOptions.headerTemplate;
      }
      if (mergedOptions.footerTemplate) {
        pdfOptions.footerTemplate = mergedOptions.footerTemplate;
      }
    }

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    return pdfBuffer;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Generate PDF from URL
 *
 * @param url - URL to render
 * @param options - PDF generation options
 * @returns PDF as Uint8Array buffer
 */
export async function generatePdfFromUrl(
  url: string,
  options: PdfGenerationOptions = {}
): Promise<Uint8Array> {
  const mergedOptions = { ...DEFAULT_PDF_OPTIONS, ...options };
  const browser = await getBrowser();
  let page: Page | null = null;

  try {
    page = await browser.newPage();

    // Set preferred color scheme
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: mergedOptions.preferredColorScheme || 'light' },
    ]);

    // Navigate to URL
    await page.goto(url, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
    });

    // Wait for fonts
    await page.evaluateHandle('document.fonts.ready');

    // Build PDF options
    const pdfOptions: PDFOptions = {
      format: mergedOptions.format === 'a4' ? 'A4' : 'Letter',
      printBackground: mergedOptions.printBackground,
      margin: mergedOptions.margin,
      scale: mergedOptions.scale,
      landscape: mergedOptions.landscape,
      displayHeaderFooter: mergedOptions.displayHeaderFooter,
    };

    if (mergedOptions.displayHeaderFooter) {
      if (mergedOptions.headerTemplate) {
        pdfOptions.headerTemplate = mergedOptions.headerTemplate;
      }
      if (mergedOptions.footerTemplate) {
        pdfOptions.footerTemplate = mergedOptions.footerTemplate;
      }
    }

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    return pdfBuffer;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

/**
 * Standard footer template with page numbers
 */
export const standardFooterTemplate = `
  <div style="width: 100%; font-size: 9px; padding: 0 0.5in; display: flex; justify-content: space-between; color: #666;">
    <span>The Cob Chronicles</span>
    <span><span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
`;

/**
 * Standard header template
 */
export const standardHeaderTemplate = `
  <div style="width: 100%; font-size: 9px; padding: 0 0.5in; text-align: right; color: #666;">
    <span class="date"></span>
  </div>
`;

export default {
  generatePdfFromHtml,
  generatePdfFromUrl,
  closeBrowser,
  standardFooterTemplate,
  standardHeaderTemplate,
};
