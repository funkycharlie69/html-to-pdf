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

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });

    // Use a data URL (very reliable in serverless)
    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    await page.goto(dataUrl, { waitUntil: "load", timeout: 30000 });
    await page.emulateMediaType("screen");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" }
    });

    // ---- Byte-level validation (no string encoding pitfalls) ----
    const okHeader =
      pdfBuffer.length > 1024 &&
      pdfBuffer[0] === 0x25 && // %
      pdfBuffer[1] === 0x50 && // P
      pdfBuffer[2] === 0x44 && // D
      pdfBuffer[3] === 0x46 && // F
      pdfBuffer[4] === 0x2d;   // -

    if (!okHeader) {
      const head = Array.from(pdfBuffer.subarray(0, 16));
      console.error("Invalid PDF header", { len: pdfBuffer.length, head });
      res.status(500).json({ error: "Generated output is not a valid PDF", details: { len: pdfBuffer.length, head } });
      return;
    }

    // Send exact buffer with explicit length
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
