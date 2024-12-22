const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');

const webtopdf = async (req, res) => {
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
        const browser = await chromium.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: true,
        });

        const context = await browser.newContext();
        const page = await context.newPage();

        await page.addStyleTag({
            url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap'
        });

        const viewportDimensions = { width: 1280, height: 800 };
        await page.setViewportSize(viewportDimensions);

        await page.goto(targetUrl, { waitUntil: 'load', timeout: 300000 });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: marginTop || '10mm',
                right: marginRight || '10mm',
                bottom: marginBottom || '10mm',
                left: marginLeft || '10mm',
            },
            scale: scaleValue,
        });

        await browser.close();

        const hostname = new URL(targetUrl).hostname.replace(/^www\./, "");

        const response = {
            ConversionCost: 1,
            Files: [
                {
                    FileName: `${hostname}.pdf`,
                    FileExt: 'pdf',
                    FileSize: pdfBuffer.length,
                    FileData: pdfBuffer.toString('base64'),
                },
            ],
        };

        res.json({ success: true, data: response });
    } catch (error) {
        console.error("Error generating PDF:", error);
        const errorMessage = error.message || "Failed to generate PDF.";
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
    return Buffer.from(await mergedPdf.save());
};

const webToPdfMerge = async (req, res) => {
    const { targetUrls, marginTop, marginRight, marginBottom, marginLeft, scale } = req.body;

    if (!targetUrls || targetUrls.length < 2) {
        return res.status(400).json({ error: "At least two URLs are required." });
    }

    let scaleValue = scale ? parseFloat(scale) / 100 : 1.0;
    if (scaleValue < 0.1 || scaleValue > 2) {
        return res.status(400).json({ error: "Scale must be between 10 and 200 percent." });
    }

    const pdfBuffers = [];

    try {
        const browser = await chromium.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: true,
        });

        for (const targetUrl of targetUrls) {
            const context = await browser.newContext();
            const page = await context.newPage();

            await page.addStyleTag({
                url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&family=Noto+Sans+Bengali&family=Noto+Sans+Tamil&display=swap'
            });

            await page.goto(targetUrl, { waitUntil: 'load', timeout: 300000 });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: marginTop || '10mm',
                    right: marginRight || '10mm',
                    bottom: marginBottom || '10mm',
                    left: marginLeft || '10mm',
                },
                scale: scaleValue,
            });

            pdfBuffers.push(pdfBuffer);
        }

        await browser.close();

        const mergedPdfBuffer = await mergePdfBuffers(pdfBuffers);
        const hostname = new URL(targetUrls[0]).hostname.replace(/^www\./, "");

        const response = {
            ConversionCost: 1,
            Files: [
                {
                    FileName: `${hostname}.pdf`,
                    FileExt: 'pdf',
                    FileSize: mergedPdfBuffer.length,
                    FileData: mergedPdfBuffer.toString('base64'),
                },
            ],
        };

        res.json({ success: true, data: response });
    } catch (error) {
        console.error("Error generating PDF:", error);
        const errorMessage = error.message || "Failed to generate PDF.";
        res.status(500).json({ error: errorMessage });
    }
};

module.exports = { webtopdf, webToPdfMerge };
