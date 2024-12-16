const puppeteer = require("puppeteer");
const url = require("url");
const chromium = require("chrome-aws-lambda");
const { PDFDocument } = require('pdf-lib'); // Make sure to install pdf-lib

const webtopdf = async (req, res) => {
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
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", '--font-render-hinting=none'],
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.addStyleTag({
            url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap'
        });

        const viewportDimensions = { "width": 1280, "height": 800 };
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
            preferCSSPageSize: true,
            margin: {
                top: marginTop || "10mm",
                right: marginRight || "10mm",
                bottom: marginBottom || "10mm",
                left: marginLeft || "10mm",
            },
            scale: scaleValue,
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
}


const webToPdfMerge = async (req, res) => {
    const {
        targetUrls,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        scale,
    } = req.body;


    if (!targetUrls || targetUrls.length < 2) {
        return res.status(400).json({ error: "Two URLs are required" });
    }

    let scaleValue;
    if (scale) {
        scaleValue = parseFloat(scale) / 100;
        if (scaleValue < 0.1 || scaleValue > 2) {
            return res.status(400).json({ error: "Scale must be between 10 and 200 percent" });
        }
    } else {
        scaleValue = 1.0; // Default scale
    }

    const pdfBuffers = [];

    try {
        const browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", '--font-render-hinting=none'],
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        const pdfOptions = {
            width: 252,
            height: 180,
            printBackground: true,
            preferCSSPageSize: true,
            landscape: true,
            margin: {
                top: marginTop || "0mm",    // Adjust as needed
                right: marginRight || "0mm", // Adjust as needed
                bottom: marginBottom || "0mm", // Adjust as needed
                left: marginLeft || "0mm",   // Adjust as needed
            },
            scale: scaleValue,
        };

        for (const targetUrl of targetUrls) {
            const page = await browser.newPage();
            await page.addStyleTag({
                url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap'
            });

            await page.addStyleTag({
                content: `
                     @page {
            size: 3.5in 2.5in; /* Width height for landscape RC card */
            margin: 0; /* No margins */
        }
        body {
            margin: 0;
            padding: 0;
            overflow: hidden; /* Prevent scrolling */
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            background: white; /* Optional background color */
        } 
                `,
            });


            const viewportDimensions = { "width": 800, "height": 600 };
            await page.setViewport(viewportDimensions);
            await page.setJavaScriptEnabled(false);
            await page.goto(targetUrl, { waitUntil: "load", timeout: 3000000 });

            const pdfBuffer = await page.pdf(pdfOptions);
            pdfBuffers.push(pdfBuffer);
            await page.close();
        }

        await browser.close();

        // Merge PDFs
        const mergedPdfBuffer = await mergePdfBuffers(pdfBuffers);

        const hostname = new URL(targetUrls[0]).hostname.replace(/^www\./, "");
        const response = {
            ConversionCost: 1,
            Files: [
                {
                    FileName: `${hostname}.pdf`,
                    FileExt: "pdf",
                    FileSize: mergedPdfBuffer.length,
                    FileData: mergedPdfBuffer.toString("base64"),
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
};

const mergePdfBuffers = async (pdfBuffers) => {
    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of pdfBuffers) {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBuffer = await mergedPdf.save();
    // console.log(mergedPdfBuffer);
    return Buffer.from(mergedPdfBuffer);
};

const imagesUrlToPdf = async (req, res) => {
    try {
        const { urls } = req.body;  // Assuming URLs are passed in the request body

        if (!urls || urls.length === 0) {
            return res.status(400).json({ error: "No URLs provided" });
        }

        const browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", '--font-render-hinting=none'],
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });
        const mergedPdf = await PDFDocument.create();

        for (const url of urls) {
            const viewportDimensions = { "width": 1000, "height": 620 };
            const page = await browser.newPage();
            await page.setViewport(viewportDimensions);
            await page.setJavaScriptEnabled(false);
            await page.goto(url,  {waitUntil: "load", timeout: 3000000 });

            // Take a screenshot of the web page
            const screenshotBuffer = await page.screenshot();

            // Load the screenshot as an image into the PDF
            const image = await mergedPdf.embedPng(screenshotBuffer);
            const { width, height } = image.scale(0.9);

            // Create a new PDF page for the screenshot
            const pdfPage = mergedPdf.addPage([width, height]);
            pdfPage.drawImage(image, {
                x: 0,
                y: 0,
                width,
                height,
            });

            await page.close();
        }

        const mergedPdfBuffer = await mergedPdf.save();
        await browser.close();

        const hostname = "merged_file"; // You can set this dynamically based on URL or req data

        // Return the response in the specified format
        const response = {
            ConversionCost: 1,
            Files: [
                {
                    FileName: `${hostname}.pdf`,
                    FileExt: "pdf",
                    FileSize: mergedPdfBuffer.length,
                    FileData: Buffer.from(mergedPdfBuffer).toString("base64"),
                },
            ],
        };

        // Send response to the client
        res.json(response);

    } catch (error) {
        console.error("Error in imagesUrlToPdf:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const imagesUrlToPdfPortration = async (req, res) => {
    try {
        const { urls } = req.body; // Assuming URLs are passed in the request body

        if (!urls || urls.length === 0) {
            return res.status(400).json({ error: "No URLs provided" });
        }

        const browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", '--font-render-hinting=none'],
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });

        const mergedPdf = await PDFDocument.create();

        for (const url of urls) {
            const page = await browser.newPage();
            await page.setJavaScriptEnabled(false); // Disable JS if not needed
            await page.goto(url, { waitUntil: "load", timeout: 3000000 });

            // Get the dimensions of the page's content
            const contentDimensions = await page.evaluate(() => {
                const body = document.body;
                const html = document.documentElement;

                const width = Math.max(
                    body.scrollWidth,
                    body.offsetWidth,
                    html.clientWidth,
                    html.scrollWidth,
                    html.offsetWidth
                );

                const height = Math.max(
                    body.scrollHeight,
                    body.offsetHeight,
                    html.clientHeight,
                    html.scrollHeight,
                    html.offsetHeight
                );

                return { width, height };
            });

            // Convert dimensions from pixels to points (1 px = 0.75 pt)
            const pointWidth = contentDimensions.width * 0.75;
            const pointHeight = contentDimensions.height * 0.75;

            // Generate a single-page PDF with precise content dimensions
            const pagePdfBuffer = await page.pdf({
                width: `${contentDimensions.width}px`,
                height: `${contentDimensions.height}px`,
                printBackground: true, // Print background colors and images
                preferCSSPageSize: false,
                margin: { top: 0, bottom: 0, left: 0, right: 0 }, // Ensure no extra blank margins
                pageRanges: '1', // Limit output to the first page
            });

            // Embed the single PDF page into the merged PDF
            const singlePdfDoc = await PDFDocument.load(pagePdfBuffer);
            const pages = await mergedPdf.copyPages(singlePdfDoc, singlePdfDoc.getPageIndices());
            for (const p of pages) mergedPdf.addPage(p);

            await page.close();
        }

        const mergedPdfBuffer = await mergedPdf.save();
        await browser.close();

        const hostname = "merged_file"; // Dynamic filename if required

        // Prepare response object
        const response = {
            ConversionCost: 1,
            Files: [
                {
                    FileName: `${hostname}.pdf`,
                    FileExt: "pdf",
                    FileSize: mergedPdfBuffer.length,
                    FileData: Buffer.from(mergedPdfBuffer).toString("base64"),
                },
            ],
        };

        // Send response to the client
        res.json(response);

    } catch (error) {
        console.error("Error in imagesUrlToPdf:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


module.exports = {
    webtopdf,
    webToPdfMerge,
    imagesUrlToPdf,
    imagesUrlToPdfPortration
}