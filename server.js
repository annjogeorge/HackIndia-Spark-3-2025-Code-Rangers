const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");
const PptxGenJS = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Create a folder to store PPT files if it doesn't exist
const pptFolder = path.join(__dirname, "ppt_files");
if (!fs.existsSync(pptFolder)) {
    fs.mkdirSync(pptFolder);
}

app.post("/generate-slides", async (req, res) => {
    try {
        const { text } = req.body;

        // Call OpenAI to generate slide content
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "user", content: `Generate structured slide points from: ${text}` }],
            max_tokens: 300,
        });

        const slides = response.choices[0].message.content.split("\n").filter(Boolean);
        res.json({ slides });
    } catch (error) {
        console.error("Error generating slides:", error);
        res.status(500).json({ error: "Error generating slides" });
    }
});

app.post("/export-ppt", async (req, res) => {
    try {
        const { slides } = req.body;

        // Create PowerPoint presentation
        let pptx = new PptxGenJS();

        slides.forEach((slideText) => {
            let slide = pptx.addSlide();
            slide.addText(slideText, { x: 1, y: 1, fontSize: 24 });
        });

        // Set the file name with a timestamp to avoid overwriting
        const pptFileName = `Generated_Presentation_${Date.now()}.pptx`;
        const pptFilePath = path.join(pptFolder, pptFileName);

        // Write the file to the disk
        await new Promise((resolve, reject) => {
            pptx.writeFile({ fileName: pptFilePath }).then(resolve).catch(reject);
        });

        // Send back the file path as a response (to be used for download)
        res.json({ message: "PPT generated successfully", downloadLink: `/download/${pptFileName}` });
    } catch (error) {
        console.error("Error generating PPT:", error);
        res.status(500).json({ error: "Error generating PPT" });
    }
});

// Serve the generated PowerPoint files for download
app.get("/download/:fileName", (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(pptFolder, fileName);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error downloading file:", err);
                res.status(500).send("Error downloading the file.");
            }
        });
    } else {
        res.status(404).send("File not found.");
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
