const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
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

function runPythonScript(jobDescription, resumes, resumeDir) {
    return new Promise((resolve, reject) => {
        const jobDescFile = path.join(__dirname, 'job_description', 'job_description.txt');
        const resumesFile = path.join(__dirname, 'resumes.txt');

        fs.writeFileSync(jobDescFile, jobDescription);
        fs.writeFileSync(resumesFile, resumes.join('\0')); // Use null character as delimiter

        exec(`python3 compute_similarity.py ${jobDescFile} ${resumesFile} ${resumeDir}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`stderr: ${stderr}`);
                // console.log(`stdout: ${stdout}`);
                reject(error);
            } else {
                // console.log(`stdout: ${stdout}`);
                resolve(stdout.trim());
            }
        });
    });
}

async function main() {
    const resumesFilePath = path.join(__dirname, 'resumes.txt');
    
    // Clear resumes.txt at the start
    fs.writeFileSync(resumesFilePath, '');

    const jobDescriptionDir = path.join(__dirname, 'job_description');
    console.log(`Looking for job description files in: ${jobDescriptionDir}`);
    const jobDescriptionFiles = fs.readdirSync(jobDescriptionDir);
    console.log(`Found files: ${jobDescriptionFiles.join(', ')}`);
    
    const jobDescriptionFile = jobDescriptionFiles.find(file => file.endsWith('.pdf') || file.endsWith('.txt') || file.endsWith('.docx'));
    if (!jobDescriptionFile) {
        throw new Error('No job description file found in the job_description folder');
    }

    const jobDescriptionPath = path.join(jobDescriptionDir, jobDescriptionFile);
    console.log(`Using job description file: ${jobDescriptionPath}`);
    const jobDescription = await extractText(jobDescriptionPath);

    const resumeDir = path.join(__dirname, 'resumes');
    console.log(`Looking for resumes in: ${resumeDir}`);
    const resumeFiles = fs.readdirSync(resumeDir).filter(file => file.endsWith('.pdf') || file.endsWith('.txt') || file.endsWith('.docx'));
    console.log(`Found resume files: ${resumeFiles.join(', ')}`);
    
    const resumes = await Promise.all(resumeFiles.map(async file => {
        const text = await extractText(path.join(resumeDir, file));
        if (!text.trim()) {
            console.log(`Warning: Empty text extracted from resume file ${file}`);
        }
        return text.trim() ? text : null;
    }));

    const filteredResumes = resumes.filter(text => text !== null);

    console.log(`Number of non-empty resumes: ${filteredResumes.length}`);
    console.log(`Number of resume files: ${resumeFiles.length}`);

    // console.log('Contents to be written to resumes.txt:', filteredResumes.join('\0'));
    fs.writeFileSync(resumesFilePath, filteredResumes.join('\0')); // Use null character as delimiter

    // const resumesContent = fs.readFileSync(resumesFilePath, 'utf8');
    // console.log('Actual contents of resumes.txt:', resumesContent);

    try {
        const similarities = await runPythonScript(jobDescription, filteredResumes, resumeDir);
        console.log(similarities);
    } catch (error) {
        console.error(error);
    }
}

main();
