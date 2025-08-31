import { chromium } from "playwright-chromium";

/**
 * Vercel Serverless Function.
 * POST JSON: { html: "<!doctype html>..."}
 * → returns application/pdf
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const { html } = req.body || {};
    if (!html || typeof html !== "string") {
      res.status(400).json({ error: "Missing `html` string in body" });
      return;
    }

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" },
      printBackground: true
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=lead-magnet.pdf");
    res.status(200).send(pdf);
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}
