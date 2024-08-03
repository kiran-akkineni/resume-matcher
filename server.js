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
const port = 3001;

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Middleware to parse JSON and form data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

let uploadedResumes = [];
let jobDescriptionText = '';
let jobDescriptionFilename = '';
let resumeScores = [];

// Route to render the upload form
app.get('/', (req, res) => {
    res.render('index', { resumes: resumeScores, jobDescription: jobDescriptionText, jobDescriptionFilename });
});

// Route to handle form submission
app.post('/submit', upload.fields([{ name: 'jobDescriptionFiles' }, { name: 'resumeFiles' }]), async (req, res) => {
    try {
        const jobDescriptionFiles = req.files.jobDescriptionFiles;
        const resumeFiles = req.files.resumeFiles;
        const replaceJobDescription = req.body.replaceJobDescription === 'on';
        const replaceResumes = req.body.replaceResumes === 'on';

        // Process job description
        if (jobDescriptionFiles && jobDescriptionFiles.length > 0) {
            const newJobDescription = await extractText(jobDescriptionFiles[0].path);
            jobDescriptionFilename = jobDescriptionFiles[0].originalname;
            if (replaceJobDescription) {
                jobDescriptionText = newJobDescription;
            } else {
                jobDescriptionText += '\n' + newJobDescription;
            }
            console.log('Job Description:', jobDescriptionText);
        }

        // If replaceResumes is checked, clear the uploadedResumes array
        if (replaceResumes) {
            uploadedResumes = [];
            resumeScores = [];
        }

        // Process resumes and add to the uploadedResumes array
        if (resumeFiles) {
            const resumes = await Promise.all(resumeFiles.map(async file => {
                try {
                    const text = await extractText(file.path);
                    console.log('Resume Text:', text);
                    return { name: file.originalname, text: text.trim() ? text : null };
                } catch (error) {
                    console.error(`Error processing file ${file.originalname}: ${error.message}`);
                    return null;
                }
            }));

            const filteredResumes = resumes.filter(resume => resume && resume.text !== null);
            uploadedResumes.push(...filteredResumes);

            // Save the job description and resumes to temporary files
            const jobDescFile = path.join(__dirname, 'uploads', 'job_description.txt');
            const resumesFile = path.join(__dirname, 'uploads', 'resumes.txt');
            const filenamesFile = path.join(__dirname, 'uploads', 'filenames.txt');
            fs.writeFileSync(jobDescFile, jobDescriptionText);
            fs.writeFileSync(resumesFile, filteredResumes.map(resume => resume.text).join('\0')); // Use null character as delimiter
            fs.writeFileSync(filenamesFile, uploadedResumes.filter(resume => resume).map(resume => resume.name).join('\n'));

            // Run the similarity script
            const similarities = await runPythonScript(jobDescFile, resumesFile, filenamesFile);
            console.log('Raw Similarities Output:', similarities); // Log the raw output from Python script

            const similarityLines = similarities.split('\n').filter(line => line.includes('Similarity Score'));

            resumeScores = similarityLines.map(line => {
                console.log('Parsing line:', line); // Log each line being parsed
                const parts = line.split(', Similarity Score: ');
                const name = parts[0].split(': ')[1];
                const score = parseFloat(parts[1]);
                console.log(`Parsed score for resume ${name}: ${score}`);
                return { name, score: isNaN(score) ? 0 : score };
            });

            console.log('Resume Scores:', resumeScores);
        }

        res.redirect('/');
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
    try {
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
    } catch (error) {
        throw new Error(`Failed to extract text from file ${filePath}: ${error.message}`);
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
