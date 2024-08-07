from flask import Flask, request, jsonify
import spacy
from multiprocessing import Process, Queue

app = Flask(__name__)
nlp = spacy.load('en_core_web_md')

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

    queue = Queue()
    process = Process(target=compute_similarity, args=(job_description, resumes, queue))
    process.start()
    process.join(timeout=25)  # Timeout to avoid Vercel limits

    if process.is_alive():
        process.terminate()
        return jsonify({'error': 'Processing time exceeded the limit.'}), 504

    similarities = queue.get()
    response = [{'filename': filenames[i], 'similarity': similarity} for i, similarity in similarities]
    return jsonify(response)

if __name__ == '__main__':
    app.run(port=5328)
