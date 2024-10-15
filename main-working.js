const express = require("express");
const puppeteer = require("puppeteer");
const url = require("url");
const chromium = require("chrome-aws-lambda");

const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
  // console.log(req.body);

  if (!targetUrl) {
    return res.status(400).json({ error: "URL is required" });
  }

  let scaleValue;
  if (scale) {
    scaleValue = parseFloat(scale) / 100;
    if (scaleValue < 0.1 || scaleValue > 2) {
      return res
        .status(400)
        .json({ error: "Scale must be between 10 and 200 percent" });
    }
  } else {
    scaleValue = 1.0; // Default scale
  }

  try {
    const browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox",'--font-render-hinting=none'],
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    await page.addStyleTag({ 
      url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap' 
    });

      const viewportDimensions = {"width":1280,"height":800};
      await page.setViewport(viewportDimensions);
    
    await page.setJavaScriptEnabled(false);
    await page.goto(targetUrl, { waitUntil: "load", timeout: 3000000 });
    // Check which fonts are loaded
    const fonts = await page.evaluate(() => {
      return Array.from(document.fonts).map(font => font.family);
    });
    // console.log('Loaded fonts:', fonts);
    const pdfOptions = {
      format: "A4",
      printBackground: true,
      fullPage: true, // Capture the full page
      margin: {
        top: marginTop || "0mm",
        right: marginRight || "0mm",
        bottom: marginBottom || "0mm",
        left: marginLeft || "0mm",
      },
      scale: scaleValue, // Set scale based on user input
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    await browser.close();

    // Extract the hostname to use as filename
    const hostname = new URL(targetUrl).hostname.replace(/^www\./, "");

    // Create the JSON response
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

    let errorMessage;
    if (error instanceof puppeteer.errors.TimeoutError) {
      errorMessage = "Failed to generate PDF: Page load timeout";
    } else {
      errorMessage = "Failed to generate PDF: " + error.message;
    }

    res.status(500).json({ error: errorMessage });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
