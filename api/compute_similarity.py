import spacy
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

nlp = spacy.load('en_core_web_md')

def compute_similarity(job_description, resumes):
    job_desc_doc = nlp(job_description)
    print("Job Description Vector Norm:", job_desc_doc.vector_norm)
    similarities = []

    for i, resume in enumerate(resumes):
        resume_doc = nlp(resume)
        print(f"Resume {i} Vector Norm:", resume_doc.vector_norm)
        if resume_doc.vector_norm:  # Check if the vector is not empty
            similarity = job_desc_doc.similarity(resume_doc)
        else:
            similarity = 0.0
            print(f"Warning: Empty vector for resume {i}")
        similarities.append((i, similarity))

    similarities.sort(key=lambda x: x[1], reverse=True)
    return similarities

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()

        # Example usage: replace with actual file paths or inputs
        job_desc_file = '/tmp/job_description.txt'
        resumes_file = '/tmp/resumes.txt'
        filenames_file = '/tmp/filenames.txt'

        try:
            with open(job_desc_file, 'r') as f:
                job_description = f.read().strip()

            with open(resumes_file, 'r') as f:
                resumes = f.read().strip().split('\0')  # Use null character as delimiter

            with open(filenames_file, 'r') as f:
                filenames = f.read().strip().split('\n')

            similarities = compute_similarity(job_description, resumes)

            response = []
            for rank, (i, score) in enumerate(similarities, start=1):
                response.append(f"Resume {rank}: {filenames[i]}, Similarity Score: {score:.4f}")
            self.wfile.write("\n".join(response).encode('utf-8'))
        except Exception as e:
            self.wfile.write(f"An error occurred: {e}".encode('utf-8'))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        job_desc_file = sys.argv[1]
        resumes_file = sys.argv[2]
        filenames_file = sys.argv[3]

        try:
            with open(job_desc_file, 'r') as f:
                job_description = f.read().strip()

            with open(resumes_file, 'r') as f:
                resumes = f.read().strip().split('\0')  # Use null character as delimiter

            with open(filenames_file, 'r') as f:
                filenames = f.read().strip().split('\n')

            similarities = compute_similarity(job_description, resumes)

            for rank, (i, score) in enumerate(similarities, start=1):
                print(f"Resume {rank}: {filenames[i]}, Similarity Score: {score:.4f}")
        except Exception as e:
            print(f"An error occurred: {e}")
            sys.exit(1)
    else:
        server_address = ('', 8000)  # Port 8000 for local testing
        httpd = HTTPServer(server_address, handler)
        print("Starting server, use <Ctrl-C> to stop")
        httpd.serve_forever()
