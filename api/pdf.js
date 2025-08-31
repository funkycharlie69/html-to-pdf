import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  let browser;
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { html } = req.body || {};
    if (!html || typeof html !== "string" || !html.trim()) {
      res.status(400).json({ error: "Missing `html` string in body" });
      return;
    }

    // Launch headless Chromium provided by @sparticuz/chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });

    // Load the HTML; avoid waiting forever on external assets
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" },
      timeout: 20000
    });

    // Validate the buffer really looks like a PDF
    const firstBytes = pdfBuffer.subarray(0, 5).toString("ascii");
    if (pdfBuffer.length < 1000 || !firstBytes.startsWith("%PDF-")) {
      console.error("Invalid PDF produced. First 16 bytes:", pdfBuffer.subarray(0, 16).toString("ascii"),
                    "Length:", pdfBuffer.length);
      res.status(500).json({ error: "Generated output is not a valid PDF" });
      return;
    }

    // Send the PDF with correct headers + length
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"lead-magnet.pdf\"");
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).end(pdfBuffer);
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
