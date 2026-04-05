const express = require("express");
const path = require("path");
const { webtopdf,webToPdfMerge,imagesUrlToPdf,imagesUrlToPdfPortration } = require('./controller/pdfController');

const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Welcome to URL to PDF converter API BY Indal Singh");
});

app.get("/tester", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tester.html"));
});

app.post("/api/convert/webtopdf", webtopdf);
app.post("/api/convert/webtopdfmerge", webToPdfMerge);
app.post("/api/convert/convert-images-to-pdf", imagesUrlToPdf);
app.post("/api/convert/convert-images-to-pdf-og", imagesUrlToPdfPortration);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
