from langchain.embeddings.base import Embeddings
from typing import List


class DummyEmbeddings(Embeddings):
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [[1.0] * 10 for _ in texts]

    def embed_query(self, text: str) -> List[float]:
        return [1.0] * 10


dummy_embeddings = DummyEmbeddings()
