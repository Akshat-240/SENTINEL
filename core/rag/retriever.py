"""
SENTINEL — RAG Retriever
Purpose: Search indexed incidents for similar conditions
Returns top 3 most relevant incidents for current zone state
"""

import os
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RAGRetriever:
    def __init__(self, index_path="faiss_indices", model_name="all-MiniLM-L6-v2"):
        """
        Initialize RAG retriever
        
        Args:
            index_path: Directory containing saved FAISS index
            model_name: Sentence transformer model (must match indexer)
        """
        self.model = SentenceTransformer(model_name)
        self.index_path = index_path
        self.index = None
        self.chunks = []
        self.load_index()
        logger.info("✅ RAG Retriever initialized")
    
    def load_index(self, filename="sentinel_rag.index"):
        """
        Load FAISS index and metadata from disk
        
        Args:
            filename: Name of saved index file
        """
        index_file = os.path.join(self.index_path, filename)
        metadata_file = os.path.join(self.index_path, f"{filename}.metadata.json")
        
        if not os.path.exists(index_file):
            logger.warning(f"⚠️  Index not found at {index_file}")
            logger.info("   Run indexer.py first to create index")
            return False
        
        try:
            self.index = faiss.read_index(index_file)
            with open(metadata_file, 'r') as f:
                self.chunks = json.load(f)
            
            logger.info(f"✅ Loaded index with {self.index.ntotal} chunks")
            logger.info(f"✅ Loaded {len(self.chunks)} metadata entries")
            return True
        except Exception as e:
            logger.error(f"❌ Error loading index: {e}")
            return False
    
    def build_query(self, zone_snapshot):
        """
        Convert zone snapshot into semantic search query
        Turns sensor data into natural language for better matching
        
        Args:
            zone_snapshot: Dict with zone conditions
                {
                    "zone_id": "A",
                    "gas_ppm": 450,
                    "temperature": 65,
                    "permits": ["hot_work", "confined_space"],
                    "worker_count": 4,
                    "shift_type": "night"
                }
        
        Returns:
            str: Natural language query for FAISS
        """
        gas = zone_snapshot.get("gas_ppm", 0)
        temp = zone_snapshot.get("temperature", 0)
        permits = zone_snapshot.get("permits", [])
        workers = zone_snapshot.get("worker_count", 0)
        shift = zone_snapshot.get("shift_type", "day")
        
        # Build semantic query
        query_parts = []
        
        if gas > 300:
            query_parts.append(f"gas accumulation {gas} PPM")
        if temp > 60:
            query_parts.append(f"elevated temperature {temp} degrees")
        if "hot_work" in permits and "confined_space" in permits:
            query_parts.append("hot work in confined space")
        elif "hot_work" in permits:
            query_parts.append("hot work permit")
        if "electrical" in permits:
            query_parts.append("electrical maintenance")
        if workers > 3:
            query_parts.append(f"{workers} workers present")
        if shift == "night":
            query_parts.append("night shift")
        
        # If no conditions, return generic query
        if not query_parts:
            query_parts.append("industrial safety incident")
        
        query = " ".join(query_parts)
        logger.info(f"🔍 Search query: {query}")
        return query
    
    def retrieve(self, zone_snapshot, top_k=3):
        """
        Search FAISS index for similar incidents
        
        Args:
            zone_snapshot: Current zone conditions
            top_k: Number of results to return
        
        Returns:
            list: Top-k similar incidents with scores
            [
                {
                    "rank": 1,
                    "score": 0.234,
                    "text": "...",
                    "source": "visakhapatnam_2025"
                },
                ...
            ]
        """
        if self.index is None or len(self.chunks) == 0:
            logger.warning("⚠️  Index not loaded. Returning empty results.")
            return []
        
        # Build semantic query from zone state
        query_text = self.build_query(zone_snapshot)
        
        # Encode query
        query_embedding = self.model.encode([query_text], convert_to_numpy=True)
        query_embedding = query_embedding.astype('float32')
        
        # Search
        distances, indices = self.index.search(query_embedding, top_k)
        
        results = []
        for rank, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx >= 0 and idx < len(self.chunks):
                chunk = self.chunks[idx]
                # Convert L2 distance to similarity score (0-1, higher=better)
                similarity = 1 / (1 + distance)
                
                results.append({
                    "rank": rank + 1,
                    "similarity_score": float(similarity),
                    "text": chunk["text"],
                    "source": chunk["source"],
                    "source_path": chunk["source_path"]
                })
                
                logger.info(f"  #{rank+1} | Score: {similarity:.3f} | Source: {chunk['source']}")
        
        return results
    
    def retrieve_with_context(self, zone_snapshot, context_window=2):
        """
        Retrieve similar incidents with expanded context
        
        Args:
            zone_snapshot: Current zone conditions
            context_window: Number of surrounding chunks to include
        
        Returns:
            list: Results with expanded context
        """
        if self.index is None:
            return []
        
        query_text = self.build_query(zone_snapshot)
        query_embedding = self.model.encode([query_text], convert_to_numpy=True)
        query_embedding = query_embedding.astype('float32')
        
        # Search for more results to gather context
        distances, indices = self.index.search(query_embedding, 3)
        
        results = []
        for rank, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx >= 0 and idx < len(self.chunks):
                chunk = self.chunks[idx]
                similarity = 1 / (1 + distance)
                
                # Find surrounding chunks from same source
                context_chunks = []
                for i, c in enumerate(self.chunks):
                    if c["source"] == chunk["source"] and abs(i - idx) <= context_window:
                        context_chunks.append(c["text"])
                
                expanded_text = "\n".join(context_chunks)
                
                results.append({
                    "rank": rank + 1,
                    "similarity_score": float(similarity),
                    "primary_chunk": chunk["text"],
                    "expanded_context": expanded_text,
                    "source": chunk["source"]
                })
        
        return results
    
    def format_results(self, results):
        """
        Format retrieval results as readable text
        
        Args:
            results: List of results from retrieve()
        
        Returns:
            str: Formatted text for display
        """
        if not results:
            return "❌ No similar incidents found in database."
        
        output = ["📚 SIMILAR HISTORICAL INCIDENTS:\n"]
        
        for result in results:
            source = result["source"].replace("_", " ").title()
            score = result["similarity_score"]
            text_preview = result["text"][:300] + "..." if len(result["text"]) > 300 else result["text"]
            
            output.append(f"#{result['rank']} | Relevance: {score*100:.1f}%")
            output.append(f"Source: {source}")
            output.append(f"---")
            output.append(text_preview)
            output.append("")
        
        return "\n".join(output)


# Demo/Testing
if __name__ == "__main__":
    retriever = RAGRetriever()
    
    # Test with different zone scenarios
    test_scenarios = [
        {
            "zone_id": "A",
            "gas_ppm": 450,
            "temperature": 62,
            "permits": ["hot_work", "confined_space"],
            "worker_count": 4,
            "shift_type": "day",
            "scenario": "High gas + hot work + confined space"
        },
        {
            "zone_id": "C",
            "gas_ppm": 380,
            "temperature": 55,
            "permits": ["electrical"],
            "worker_count": 2,
            "shift_type": "night",
            "scenario": "Electrical work at night"
        },
        {
            "zone_id": "B",
            "gas_ppm": 300,
            "temperature": 40,
            "permits": [],
            "worker_count": 1,
            "shift_type": "day",
            "scenario": "Normal conditions"
        }
    ]
    
    print("=" * 60)
    print("SENTINEL RAG RETRIEVER TEST")
    print("=" * 60)
    
    for scenario in test_scenarios:
        print(f"\n🔬 Scenario: {scenario['scenario']}")
        print(f"   Zone {scenario['zone_id']} | Gas: {scenario['gas_ppm']} PPM | Temp: {scenario['temperature']}°C")
        
        results = retriever.retrieve(scenario, top_k=3)
        formatted = retriever.format_results(results)
        print(formatted)
        print("-" * 60)