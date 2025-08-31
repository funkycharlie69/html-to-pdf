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

    // Recommended flags for serverless
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    // Launch Chromium supplied by @sparticuz/chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });

    // Use a DATA URL instead of setContent (more reliable in Lambda/Serverless)
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    await page.goto(dataUrl, { waitUntil: "load", timeout: 30000 });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" },
      timeout: 30000
    });

    // Validate the buffer: must be at least ~1KB and start with %PDF-
    const sig = pdfBuffer.subarray(0, 5).toString("ascii");
    if (pdfBuffer.length < 1024 || !sig.startsWith("%PDF-")) {
      const head16 = pdfBuffer.subarray(0, 16).toString("ascii");
      console.error("Invalid PDF produced", { len: pdfBuffer.length, head16 });
      res.status(500).json({
        error: "Generated output is not a valid PDF",
        details: { len: pdfBuffer.length, head16 }
      });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"lead-magnet.pdf\"");
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.status(200).end(pdfBuffer);
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  } finally {
    try { await browser?.close(); } catch {}
  }
}
