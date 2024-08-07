from flask import Flask, request, jsonify
import spacy
import subprocess

app = Flask(__name__)

# Ensure the model is loaded
try:
    nlp = spacy.load('en_core_web_md')
except OSError:
    subprocess.run(["python", "-m", "spacy", "download", "en_core_web_md"])
    nlp = spacy.load('en_core_web_md')

def compute_similarity(job_description, resumes):
    job_desc_doc = nlp(job_description)
    similarities = []

    for i, resume in enumerate(resumes):
        resume_doc = nlp(resume)
        if resume_doc.vector_norm:
            similarity = job_desc_doc.similarity(resume_doc)
        else:
            similarity = 0.0
        similarities.append((i, similarity))

    similarities.sort(key=lambda x: x[1], reverse=True)
    return similarities

@app.route('/api/compute_similarity', methods=['POST'])
def compute_similarity_endpoint():
    data = request.json
    job_description = data['job_description']
    resumes = data['resumes']
    filenames = data['filenames']

    similarities = compute_similarity(job_description, resumes)

    response = [{'filename': filenames[i], 'similarity': similarity} for i, similarity in similarities]
    return jsonify(response)

if __name__ == '__main__':
    app.run(port=5328)
