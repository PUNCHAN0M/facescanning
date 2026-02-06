import faiss
import numpy as np
from collections import Counter

from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore

from app.configs.core_config import CoreConfig
from app.core.dummy_embedding import DummyEmbeddings


class FaceRecognition:

    def __init__(self, core_config: CoreConfig, dummy_embeddings: DummyEmbeddings):
        self.core_config = core_config
        self.dummy_embeddings = dummy_embeddings
        try:
            self.index = None
            self.index_ivf = None
            self.id_to_name = {}
            self.faiss_db = None
        except Exception as e:
            raise RuntimeError(
                f"Failed to initialize FaceRecognition: {e}. Ensure FAISS and dependencies are installed."
            )

    def load_faiss_index(self):
        """Load FAISS index and mappings for face recognition with error handling."""
        try:
            # Load FAISS vector store
            self.faiss_db = FAISS.load_local(
                self.core_config.vector_path,
                embeddings=self.dummy_embeddings,
                allow_dangerous_deserialization=True,
            )

            # Load the FAISS index directly from file
            self.index = faiss.read_index(self.core_config.faiss_path)

            if not isinstance(self.index, faiss.IndexIDMap):
                raise ValueError("Loaded index is not of type IndexIDMap")

            self.index_ivf = self.index  # IVF index used for searching

            # Build mapping from FAISS index ID to name
            docstore = self.faiss_db.docstore
            assert isinstance(docstore, InMemoryDocstore), "Expected InMemoryDocstore"

            docstore_dict = docstore._dict
            index_to_docstore_id = self.faiss_db.index_to_docstore_id

            self.id_to_name = {
                faiss_idx: docstore_dict[doc_id].metadata.get("name", self.core_config.UNKNOWN)
                for faiss_idx, doc_id in index_to_docstore_id.items()
                if doc_id in docstore_dict
            }

        except FileNotFoundError as e:
            print(f"[ERROR] File not found during FAISS index loading: {e}")
        except ValueError as e:
            print(f"[ERROR] Value error during FAISS index loading: {e}")
        except Exception as e:
            print(f"[ERROR] Failed to load FAISS index: {e}")

    async def find_best_match(self, embedding):
        """Find the best matching person for given embedding with error handling."""
        try:
            if self.index is None:
                raise ValueError("FAISS index has not been loaded.")

            # Normalize the input embedding
            embedding = embedding / np.linalg.norm(embedding)

            # Search for k nearest neighbors
            distances, indices = self.index_ivf.search(  # type: ignore
                np.array([embedding]), k=self.core_config.recognition_k_neighbors
            )

            # Map FAISS index IDs to names
            matched_names = [self.id_to_name.get(int(i), "Unknown") for i in indices[0]]
            name_counter = Counter(matched_names)

            if not name_counter:
                return self.core_config.UNKNOWN

            most_common_name = name_counter.most_common(1)[0][0]

            # Check distance threshold
            if distances[0][0] < self.core_config.facenet_threshold:
                return most_common_name
            else:
                return self.core_config.UNKNOWN

        except ValueError as ve:
            print(f"[ERROR] Error during recognition: {ve}")
            return self.core_config.UNKNOWN
        except Exception as e:
            print(f"[ERROR] Unexpected error during recognition: {e}")
            return self.core_config.UNKNOWN
