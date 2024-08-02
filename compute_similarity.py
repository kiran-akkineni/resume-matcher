import spacy
import sys

nlp = spacy.load('en_core_web_md')

def compute_similarity(job_description, resumes):
    job_desc_doc = nlp(job_description)
    resume_docs = [nlp(resume) for resume in resumes]
    
    similarities = []
    for i, resume_doc in enumerate(resume_docs):
        if resume_doc.vector_norm:  # Check if the vector is not empty
            similarity = job_desc_doc.similarity(resume_doc)
        else:
            similarity = 0.0
            print(f"Warning: Empty vector for resume {i}")
        similarities.append((i, similarity))
    
    similarities.sort(key=lambda x: x[1], reverse=True)
    return similarities

if __name__ == "__main__":
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
        
        for i, score in similarities:
            print(f"Resume: {filenames[i]}, Similarity Score: {score}")
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
