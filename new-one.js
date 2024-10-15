const express = require("express");
const puppeteer = require("puppeteer");
const url = require("url");
const chromium = require("chrome-aws-lambda");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


const generatePDF = async (page, pdfOptions) => {
  const contentHeight = await page.evaluate(() => {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
  });

  const a4Height = 297; // A4 height in mm
  const a4Width = 210;  // A4 width in mm

  const numPages = Math.ceil(contentHeight / a4Height);

  // Set the page height to match the content
  await page.setViewport({
    width: a4Width,
    height: contentHeight,
    deviceScaleFactor: 1,
  });

  return await page.pdf({
    ...pdfOptions,
    width: `${a4Width}mm`,
    height: `${a4Height}mm`,
    pageRanges: `1-${numPages}`,
  });
};

app.get("/", (req, res) => {
  res.send("Welcome to URL to PDF converter API");
});

app.post("/api/convert/webtopdf", async (req, res) => {
  const {
    url: targetUrl,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    scale,
  } = req.body;

  if (!targetUrl) {
    return res.status(400).json({ error: "URL is required" });
  }

  let scaleValue = scale ? parseFloat(scale) / 100 : 1.0;
  if (scaleValue < 0.1 || scaleValue > 2) {
    return res.status(400).json({ error: "Scale must be between 10 and 200 percent" });
  }

  try {
    const browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", '--font-render-hinting=none'],
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.addStyleTag({ 
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap' 
    });

    const viewportDimensions = {"width": 1280, "height": 800};
    await page.setViewport(viewportDimensions);
    
    await page.setJavaScriptEnabled(false);
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 60000 });

    const pdfOptions = {
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: marginTop || "10mm",
        right: marginRight || "10mm",
        bottom: marginBottom || "10mm",
        left: marginLeft || "10mm",
      },
      scale: scaleValue,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size: 10px; text-align: right; width: 100%; padding-right: 10mm;"></span></div>',
      footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;"></div>',
    };

    // Function to check if content overflows
    const checkOverflow = async () => {
      return page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
        return height > html.clientHeight;
      });
    };

    // Adjust scale if content overflows
    const adjustScale = async (options) => {
      let scale = options.scale;
      const overflows = await checkOverflow();
      
      if (overflows) {
        while (scale > 0.1 && await checkOverflow()) {
          scale -= 0.1;
          await page.evaluate((s) => {
            document.body.style.transform = `scale(${s})`;
            document.body.style.transformOrigin = 'top left';
          }, scale);
        }
      }
      
      return { ...options, scale };
    };

    const adjustedOptions = await adjustScale(pdfOptions);
    const pdfBuffer = await page.pdf(adjustedOptions);

    await browser.close();

    const hostname = new URL(targetUrl).hostname.replace(/^www\./, "");

    const response = {
      ConversionCost: 1,
      Files: [
        {
          FileName: `${hostname}.pdf`,
          FileExt: "pdf",
          FileSize: pdfBuffer.length,
          FileData: pdfBuffer.toString("base64"),
        },
      ],
    };

    res.setHeader("Content-Type", "application/json");
    res.json({ success: true, data: response });
  } catch (error) {
    console.error("Error generating PDF:", error);

    let errorMessage = error instanceof puppeteer.errors.TimeoutError
      ? "Failed to generate PDF: Page load timeout"
      : "Failed to generate PDF: " + error.message;

    res.status(500).json({ error: errorMessage });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});