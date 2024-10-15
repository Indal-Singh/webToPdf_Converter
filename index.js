const express = require("express");
const { webtopdf,webToPdfMerge } = require('./controller/pdfController');

const dotenv = require("dotenv");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to URL to PDF converter API BY Indal Singh");
});

app.post("/api/convert/webtopdf", webtopdf);
app.post("/api/convert/webtopdfmerge", webToPdfMerge);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
