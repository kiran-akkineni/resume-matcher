const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const multer = require('multer');
const { exec } = require('child_process');

// Configure multer for file uploads, preserving original file extension
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage });

const app = express();
const port = 3000;

// Middleware to parse JSON and form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to handle form submission
app.post('/submit', upload.fields([{ name: 'jobDescriptionFiles' }, { name: 'resumeFiles' }]), async (req, res) => {
    try {
        const jobDescriptionFiles = req.files.jobDescriptionFiles;
        const resumeFiles = req.files.resumeFiles;

        // Ensure files are uploaded
        if (!jobDescriptionFiles || !resumeFiles) {
            return res.status(400).send('Please upload both job description and resume files.');
        }

        // Process job description and resumes
        const jobDescription = await extractText(jobDescriptionFiles[0].path);
        const resumes = await Promise.all(resumeFiles.map(async file => {
            const text = await extractText(file.path);
            return { name: file.originalname, text: text.trim() ? text : null };
        }));

        const filteredResumes = resumes.filter(resume => resume.text !== null);

        // Save the job description and resumes to temporary files
        const jobDescFile = path.join(__dirname, 'uploads', 'job_description.txt');
        const resumesFile = path.join(__dirname, 'uploads', 'resumes.txt');
        const filenamesFile = path.join(__dirname, 'uploads', 'filenames.txt');
        fs.writeFileSync(jobDescFile, jobDescription);
        fs.writeFileSync(resumesFile, filteredResumes.map(resume => resume.text).join('\0')); // Use null character as delimiter
        fs.writeFileSync(filenamesFile, filteredResumes.map(resume => resume.name).join('\n'));

        // Run the similarity script
        const similarities = await runPythonScript(jobDescFile, resumesFile, filenamesFile);
        res.send(similarities);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});

// Extract text from different file formats
async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    console.log(`Extracting text from file: ${filePath} with extension: ${ext}`);
    if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;
    } else if (ext === '.txt') {
        return fs.readFileSync(filePath, 'utf8');
    } else if (ext === '.docx') {
        const { value: text } = await mammoth.extractRawText({ path: filePath });
        return text;
    } else {
        throw new Error('Unsupported file format: ' + ext);
    }
}

// Run the Python script to compute similarities
function runPythonScript(jobDescFile, resumesFile, filenamesFile) {
    return new Promise((resolve, reject) => {
        exec(`python3 compute_similarity.py ${jobDescFile} ${resumesFile} ${filenamesFile}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`stderr: ${stderr}`);
                console.log(`stdout: ${stdout}`);
                reject(error);
            } else {
                console.log(`stdout: ${stdout}`);
                resolve(stdout.trim());
            }
        });
    });
}
