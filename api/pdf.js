import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { html } = req.body || {};
    if (!html || typeof html !== "string") return res.status(400).json({ error: "Missing `html`" });

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" }
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
