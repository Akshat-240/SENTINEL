"""
SENTINEL — RAG Indexer
Purpose: Load incident PDFs and text reports, then index them into FAISS for fast similarity search
"""

import os
import sys
import pypdf
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
import faiss
import json
import logging

# Resolve project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RAGIndexer:
    def __init__(self, model_name="all-MiniLM-L6-v2", index_path=None):
        """
        Initialize FAISS indexer with sentence-transformers embeddings
        
        Args:
            model_name: Sentence transformer model (lightweight for production)
            index_path: Directory to store FAISS indices
        """
        self.model = SentenceTransformer(model_name)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        
        if index_path is None:
            index_path = os.path.join(PROJECT_ROOT, settings.FAISS_INDEX_PATH)
        self.index_path = index_path
        self.documents = []  # Store document metadata
        self.chunks = []  # Store text chunks
        
        os.makedirs(index_path, exist_ok=True)
        logger.info(f"✅ RAG Indexer initialized | Model: {model_name} | Dim: {self.embedding_dim}")
    
    def extract_pdf_text(self, pdf_path):
        """
        Extract text from PDF file using pypdf
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            str: Full text content from PDF
        """
        try:
            text = ""
            with open(pdf_path, 'rb') as file:
                reader = pypdf.PdfReader(file)
                for page_num in range(len(reader.pages)):
                    page = reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            
            logger.info(f"✅ Extracted {len(text)} chars from {Path(pdf_path).name}")
            return text
        except Exception as e:
            logger.error(f"❌ Error extracting PDF {pdf_path}: {e}")
            return ""
    
    def chunk_text(self, text, chunk_size=500, overlap=100):
        """
        Split text into overlapping chunks for better context
        
        Args:
            text: Full text to chunk
            chunk_size: Characters per chunk
            overlap: Character overlap between chunks
            
        Returns:
            list: List of text chunks
        """
        chunks = []
        text = text.strip()
        if len(text) <= chunk_size:
            return [text] if len(text) > 20 else []
            
        for i in range(0, len(text), chunk_size - overlap):
            chunk = text[i:i + chunk_size]
            if len(chunk.strip()) > 50:  # Skip tiny chunks
                chunks.append(chunk)
        
        return chunks
    
    def index_pdf(self, pdf_path, doc_name=None):
        """
        Index a single PDF into FAISS
        
        Args:
            pdf_path: Path to PDF file
            doc_name: Friendly name for document (if None, use filename)
        """
        if doc_name is None:
            doc_name = Path(pdf_path).stem
        
        # Extract text
        text = self.extract_pdf_text(pdf_path)
        if not text:
            return
        
        # Chunk text
        chunks = self.chunk_text(text)
        logger.info(f"📦 Created {len(chunks)} chunks from {doc_name}")
        
        if not chunks:
            return
            
        # Embed chunks
        embeddings = self.model.encode(chunks, convert_to_numpy=True)
        
        # Add to FAISS
        self.index.add(embeddings.astype('float32'))
        
        # Store metadata
        for chunk in chunks:
            self.chunks.append({
                "text": chunk,
                "source": doc_name,
                "source_path": str(pdf_path)
            })
        
        logger.info(f"✅ Indexed {doc_name} | Total chunks: {len(self.chunks)}")
    
    def index_txt(self, txt_path, doc_name=None):
        """
        Index a single text file into FAISS
        
        Args:
            txt_path: Path to TXT file
            doc_name: Friendly name for document (if None, use filename)
        """
        if doc_name is None:
            doc_name = Path(txt_path).stem
            
        try:
            with open(txt_path, 'r', encoding='utf-8') as file:
                text = file.read()
                
            if not text.strip():
                return
                
            chunks = self.chunk_text(text)
            logger.info(f"📦 Created {len(chunks)} chunks from {doc_name}")
            
            if not chunks:
                return
                
            embeddings = self.model.encode(chunks, convert_to_numpy=True)
            self.index.add(embeddings.astype('float32'))
            
            for chunk in chunks:
                self.chunks.append({
                    "text": chunk,
                    "source": doc_name,
                    "source_path": str(txt_path)
                })
                
            logger.info(f"✅ Indexed {doc_name} | Total chunks: {len(self.chunks)}")
        except Exception as e:
            logger.error(f"❌ Error indexing text file {txt_path}: {e}")
    
    def index_directory(self, doc_dir):
        """
        Index all PDFs and TXT files in a directory
        
        Args:
            doc_dir: Directory containing document files
        """
        doc_path = Path(doc_dir)
        pdf_files = list(doc_path.glob("*.pdf"))
        txt_files = list(doc_path.glob("*.txt"))
        logger.info(f"📂 Found {len(pdf_files)} PDFs and {len(txt_files)} TXT files in {doc_dir}")
        
        for pdf_path in pdf_files:
            self.index_pdf(str(pdf_path))
        for txt_path in txt_files:
            self.index_txt(str(txt_path))
        
        logger.info(f"✅ Indexed directory {doc_dir} | Total chunks: {len(self.chunks)}")
    
    def index_synthetic_incidents(self):
        """
        Create synthetic incident profiles for demo (Days 1-4)
        """
        synthetic_docs = {
            "visakhapatnam_2025": """
            VISAKHAPATNAM STEEL PLANT INCIDENT — January 7, 2025
            Location: Pellet Plant-2, Zone A
            
            Timeline:
            08:00 AM — Morning shift begins. Gas sensors operational.
            08:15 AM — Hot work permit issued for maintenance in Zone A
            08:20 AM — Permit includes confined space entry approval
            08:45 AM — Gas readings spike: 450 PPM H2S detected
            09:00 AM — No automated alert. Workers continue entry.
            09:15 AM — Gas levels reach 650 PPM
            09:20 AM — First worker collapses. Alarm triggered manually.
            09:35 AM — 8 workers dead. Emergency response initiated.
            
            Root Cause:
            - Gas sensors transmitted alerts to central system
            - No compound risk detection (sensor + permit + worker combination)
            - Permits manually approved despite rising sensor data
            - No time-to-critical prediction
            
            OISD Violations:
            - OISD-GDN-192: Hot work not suspended when gas exceeded 500 PPM
            - Factory Act Section 36: Confined space entry without continuous monitoring
            - DGMS Circular 2019: Permit system not integrated with real-time sensors
            
            Prevention Measure (SENTINEL):
            If compound risk engine had blocked permit OR predicted gas trajectory,
            deaths would have been preventable.
            """,
            
            "haldia_refinery_2019": """
            HALDIA REFINERY EXPLOSION — 2019
            Location: Fractionation Unit, Zone C
            
            Incident:
            23:30 — Night shift. Worker count reduced.
            23:45 — Electrical maintenance permit issued in Zone C
            23:50 — Temperature monitor shows 62°C (rising)
            00:15 — Gas concentrations climb to 380 PPM
            00:30 — Maintenance crew unaware of conditions
            00:42 — Vapor accumulation ignited by electrical spark
            00:43 — Localized explosion. 3 fatalities.
            
            Contributing Factors:
            - Night shift staffing reduced (fewer safety personnel)
            - Electrical permit issued without cross-check with temperature
            - No trend prediction (rising temp trajectory not flagged)
            - CCTV coverage gap during night shift
            
            OISD Reference:
            OISD-GDN-188: Electrical work in potentially explosive areas
            requires continuous atmospheric monitoring and trend analysis.
            """,
            
            "jamshedpur_near_miss_2021": """
            JAMSHEDPUR STEEL PLANT NEAR-MISS — 2021
            
            Incident:
            14:00 — Hot work permit (#45) issued for Zone B
            14:15 — Workers begin welding in confined space area
            14:25 — Gas sensor shows unusual reading: 480 PPM
            14:30 — Senior supervisor manually checks permit
            14:35 — Supervisor halts work immediately (decision based on experience, not system)
            14:40 — Gas rises to 780 PPM within 5 minutes
            14:45 — If work had continued 10 more minutes, fatalities likely
            
            Why It Became a Near-Miss (Not Incident):
            - Experienced supervisor made manual decision to stop
            - No system guidance provided
            - Pure luck and human judgment prevented tragedy
            
            SENTINEL Opportunity:
            Compound risk engine would have:
            1. Detected hot work + confined space + rising gas = forbidden combination
            2. Predicted time-to-critical (18 minutes remaining)
            3. Automatically blocked permit extension
            4. Prevented supervisor from having to make the decision manually
            """
        }
        
        for doc_name, content in synthetic_docs.items():
            chunks = self.chunk_text(content, chunk_size=300)
            if not chunks:
                continue
            embeddings = self.model.encode(chunks, convert_to_numpy=True)
            self.index.add(embeddings.astype('float32'))
            
            for chunk in chunks:
                self.chunks.append({
                    "text": chunk,
                    "source": doc_name,
                    "source_path": "synthetic"
                })
            
            logger.info(f"✅ Indexed synthetic: {doc_name}")
    
    def save_index(self, filename="sentinel_rag.index"):
        """Save FAISS index and metadata to disk"""
        index_file = os.path.join(self.index_path, filename)
        metadata_file = os.path.join(self.index_path, f"{filename}.metadata.json")
        
        faiss.write_index(self.index, index_file)
        with open(metadata_file, 'w') as f:
            json.dump(self.chunks, f)
        
        logger.info(f"✅ Saved FAISS index: {index_file}")
        logger.info(f"✅ Saved metadata: {metadata_file}")
        return index_file, metadata_file
    
    def load_index(self, filename="sentinel_rag.index"):
        """Load FAISS index and metadata from disk"""
        index_file = os.path.join(self.index_path, filename)
        metadata_file = os.path.join(self.index_path, f"{filename}.metadata.json")
        
        if os.path.exists(index_file):
            self.index = faiss.read_index(index_file)
            with open(metadata_file, 'r') as f:
                self.chunks = json.load(f)
            logger.info(f"✅ Loaded FAISS index: {index_file}")
            return True
        
        logger.warning(f"⚠️ Index not found: {index_file}")
        return False


# Execute indexing when run directly
if __name__ == "__main__":
    indexer = RAGIndexer()
    
    # 1. Index synthetic incidents (baseline)
    indexer.index_synthetic_incidents()
    
    # 2. Index real documents in corpus directory
    corpus_dir = os.path.join(PROJECT_ROOT, "data/incident_corpus")
    if os.path.exists(corpus_dir):
        indexer.index_directory(corpus_dir)
    else:
        logger.warning(f"⚠️ Corpus directory not found at {corpus_dir}")
        
    # Save the index
    indexer.save_index()
    
    print(f"\n📊 Indexing Complete:")
    print(f"   Total chunks: {len(indexer.chunks)}")
    print(f"   Index size: {indexer.index.ntotal}")