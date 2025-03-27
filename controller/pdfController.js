const { chromium } = require('playwright'); // Playwright library
const { PDFDocument } = require('pdf-lib'); // Make sure to install pdf-lib

const webtopdf = async (req, res) => {
    const { 
        url: targetUrl, 
        marginTop, 
        marginRight, 
        marginBottom, 
        marginLeft, 
        scale 
    } = req.body;

    if (!targetUrl) {
        return res.status(400).json({ error: "URL is required" });
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

    try {
        const browser = await chromium.launch({
            headless: true, // Headless mode (could also be false for debugging)
        });

        const page = await browser.newPage();
        await page.addStyleTag({
            url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap'
        });

        const viewportDimensions = { width: 1280, height: 800 };
        await page.setViewportSize(viewportDimensions);
        await page.setJavaScriptEnabled(false);
        await page.goto(targetUrl, { waitUntil: "load", timeout: 3000000 });

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
        let errorMessage;
        if (error.message.includes("Timeout")) {
            errorMessage = "Failed to generate PDF: Page load timeout";
        } else {
            errorMessage = "Failed to generate PDF: " + error.message;
        }

        res.status(500).json({ error: errorMessage });
    }
};

const webToPdfMerge = async (req, res) => {
    const { 
        targetUrls, 
        marginTop, 
        marginRight, 
        marginBottom, 
        marginLeft, 
        scale 
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
        const browser = await chromium.launch({
            headless: true,
        });

        const pdfOptions = {
            width: 252,
            height: 180,
            printBackground: true,
            preferCSSPageSize: true,
            landscape: true,
            margin: {
                top: marginTop || "0mm",
                right: marginRight || "0mm",
                bottom: marginBottom || "0mm",
                left: marginLeft || "0mm",
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
                    @page { size: 3.5in 2.5in; margin: 0; }
                    body { margin: 0; padding: 0; overflow: hidden; display: flex; justify-content: center; align-items: center; background: white; }
                `,
            });

            const viewportDimensions = { width: 800, height: 600 };
            await page.setViewportSize(viewportDimensions);
            await page.setJavaScriptEnabled(false);
            await page.goto(targetUrl, { waitUntil: "load", timeout: 3000000 });

            const pdfBuffer = await page.pdf(pdfOptions);
            pdfBuffers.push(pdfBuffer);
            await page.close();
        }

        await browser.close();

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
        if (error.message.includes("Timeout")) {
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
    return Buffer.from(mergedPdfBuffer);
};

const imagesUrlToPdf = async (req, res) => {
    try {
        const { urls } = req.body;

        if (!urls || urls.length === 0) {
            return res.status(400).json({ error: "No URLs provided" });
        }

        const browser = await chromium.launch({
            headless: true,
        });
        const mergedPdf = await PDFDocument.create();

        for (const url of urls) {
            const viewportDimensions = { width: 1000, height: 620 };
            const page = await browser.newPage();
            await page.setViewportSize(viewportDimensions);
            await page.setJavaScriptEnabled(false);
            await page.goto(url, { waitUntil: "load", timeout: 3000000 });

            const screenshotBuffer = await page.screenshot();

            const image = await mergedPdf.embedPng(screenshotBuffer);
            const { width, height } = image.scale(0.9);

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

        const hostname = "merged_file";

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

        res.json(response);

    } catch (error) {
        console.error("Error in imagesUrlToPdf:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const imagesUrlToPdfPortration = async (req, res) => {
    try {
        const { urls } = req.body;

        console.log(urls);  // Debugging

        if (!urls || urls.length === 0) {
            return res.status(400).json({ error: "No URLs provided" });
        }

        const browser = await chromium.launch({
            headless: true,
        });

        const mergedPdf = await PDFDocument.create();

        for (const url of urls) {
            // Ensure the URL is well-formed and starts with http:// or https://
            const validUrl = new URL(url.trim());
            const normalizedUrl = validUrl.protocol ? url : `http://${url.trim()}`;

            const page = await browser.newPage();

            // Block JavaScript execution by intercepting requests
            await page.route('**/*', (route, request) => {
                if (request.resourceType() === 'script') {
                    route.abort();  // Block JS files
                } else {
                    route.continue();
                }
            });

            try {
                await page.goto(normalizedUrl, { waitUntil: "load", timeout: 3000000 });
            } catch (err) {
                console.error(`Failed to navigate to ${normalizedUrl}: ${err}`);
                continue;  // Skip this URL if navigation fails
            }

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

            const screenshotBuffer = await page.screenshot({
                fullPage: true,
                clip: { x: 0, y: 0, width: contentDimensions.width, height: contentDimensions.height },
            });

            const image = await mergedPdf.embedPng(screenshotBuffer);
            const { width, height } = image.scale(0.9);

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

        const hostname = "merged_portrait_file";

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

        res.json(response);

    } catch (error) {
        console.error("Error in imagesUrlToPdfPortration:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



module.exports = {
    webtopdf,
    webToPdfMerge,
    imagesUrlToPdf,
    imagesUrlToPdfPortration,
};
