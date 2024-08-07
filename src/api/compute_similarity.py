from flask import Flask, request, jsonify
import spacy
import subprocess
import threading

app = Flask(__name__)

# Ensure the model is loaded
def load_model():
    global nlp
    try:
        nlp = spacy.load('en_core_web_md')
    except OSError:
        subprocess.run(["python", "-m", "spacy", "download", "en_core_web_md"])
        nlp = spacy.load('en_core_web_md')

load_model()

def compute_similarity(job_description, resumes, queue):
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
    queue.put(similarities)

@app.route('/api/compute_similarity', methods=['POST'])
def compute_similarity_endpoint():
    data = request.json
    job_description = data['job_description']
    resumes = data['resumes']
    filenames = data['filenames']

    queue = queue.Queue()
    thread = threading.Thread(target=compute_similarity, args=(job_description, resumes, queue))
    thread.start()
    thread.join(timeout=25)  # Timeout to avoid Vercel limits

    if thread.is_alive():
        return jsonify({'error': 'Processing time exceeded the limit.'}), 504

    similarities = queue.get()
    response = [{'filename': filenames[i], 'similarity': similarity} for i, similarity in similarities]
    return jsonify(response)

if __name__ == '__main__':
    app.run(port=5328)
