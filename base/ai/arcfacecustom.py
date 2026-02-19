"""
ArcFace Custom Embedder - Production-Ready Face Embedding Service

This module provides a production-ready implementation of ArcFace face embeddings
that matches the client-side (Scan.jsx) preprocessing exactly for consistent results.

Features:
- Singleton pattern for efficient model management
- Batch processing support
- Configurable execution providers (CPU/CUDA)
- Comprehensive error handling and logging
- Type hints for better IDE support

Author: FaceScanning Team
Version: 2.0.0
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import List, Optional, Tuple, Union

import cv2
import numpy as np
import onnxruntime as ort

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ExecutionProvider(Enum):
    """Supported ONNX Runtime execution providers."""
    CPU = "CPUExecutionProvider"
    CUDA = "CUDAExecutionProvider"
    TENSORRT = "TensorrtExecutionProvider"
    DIRECTML = "DmlExecutionProvider"


@dataclass(frozen=True)
class EmbeddingConfig:
    """Configuration for ArcFace embedding extraction."""
    input_size: int = 112
    embedding_dim: int = 512
    normalize_mean: float = 127.5
    normalize_std: float = 128.0


@dataclass
class EmbeddingResult:
    """Result of embedding extraction."""
    embedding: Optional[np.ndarray]
    success: bool
    error_message: Optional[str] = None
    processing_time_ms: float = 0.0


class ArcFaceEmbedder:
    """
    Production-ready ArcFace Embedder.
    
    Implements the same preprocessing as client-side (Scan.jsx) for consistency:
    1. Resize to 112x112
    2. RGB ordering
    3. Normalize: (pixel - 127.5) / 128 → range [-1, 1]
    4. Channel order: CHW (Channel, Height, Width)
    5. L2 normalize output embedding
    
    Usage:
        embedder = ArcFaceEmbedder()
        embedding = embedder.get_embedding(face_image)
    """
    
    # Class-level constants
    MODEL_SEARCH_PATHS = (
        "../client/public/w600k_mbf.onnx",
        "w600k_mbf.onnx",
        "./models/w600k_mbf.onnx",
    )
    
    _instance: Optional[ArcFaceEmbedder] = None
    _lock: threading.Lock = threading.Lock()
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        config: Optional[EmbeddingConfig] = None,
        providers: Optional[List[str]] = None
    ):
        """
        Initialize the ArcFace embedder.
        
        Args:
            model_path: Path to w600k_mbf.onnx model. Auto-detected if None.
            config: Embedding configuration. Uses defaults if None.
            providers: ONNX execution providers. Auto-selected if None.
        """
        self.config = config or EmbeddingConfig()
        self._model_path = self._resolve_model_path(model_path)
        self._providers = providers or self._get_default_providers()
        
        self._session: Optional[ort.InferenceSession] = None
        self._input_name: Optional[str] = None
        self._output_name: Optional[str] = None
        self._is_initialized = False
        
        self._initialize()
    
    @classmethod
    def get_instance(
        cls,
        model_path: Optional[str] = None,
        **kwargs
    ) -> ArcFaceEmbedder:
        """
        Get singleton instance of ArcFaceEmbedder.
        
        Thread-safe implementation using double-checked locking.
        
        Args:
            model_path: Optional path to model file
            **kwargs: Additional arguments for initialization
            
        Returns:
            ArcFaceEmbedder singleton instance
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(model_path=model_path, **kwargs)
        return cls._instance
    
    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton instance. Useful for testing."""
        with cls._lock:
            cls._instance = None
    
    def _resolve_model_path(self, model_path: Optional[str]) -> str:
        """
        Resolve and validate model path.
        
        Args:
            model_path: Provided model path or None for auto-detection
            
        Returns:
            Validated model path
            
        Raises:
            FileNotFoundError: If model cannot be found
        """
        if model_path:
            path = Path(model_path)
            if path.exists():
                return str(path)
            raise FileNotFoundError(f"Model not found at: {model_path}")
        
        # Auto-detect model path
        base_path = Path(__file__).parent
        for relative_path in self.MODEL_SEARCH_PATHS:
            full_path = base_path / relative_path
            if full_path.exists():
                logger.info(f"Found model at: {full_path}")
                return str(full_path)
        
        raise FileNotFoundError(
            "Cannot find w600k_mbf.onnx. Please provide model_path. "
            f"Searched in: {self.MODEL_SEARCH_PATHS}"
        )
    
    def _get_default_providers(self) -> List[str]:
        """Get default execution providers based on availability."""
        available = ort.get_available_providers()
        
        # Prefer GPU providers if available
        preferred_order = [
            ExecutionProvider.CUDA.value,
            ExecutionProvider.TENSORRT.value,
            ExecutionProvider.DIRECTML.value,
            ExecutionProvider.CPU.value,
        ]
        
        providers = []
        for provider in preferred_order:
            if provider in available:
                providers.append(provider)
        
        if not providers:
            providers = [ExecutionProvider.CPU.value]
            
        return providers
    
    def _initialize(self) -> None:
        """Initialize ONNX session and validate model."""
        try:
            logger.info(f"Initializing ArcFaceEmbedder with model: {self._model_path}")
            logger.info(f"Using providers: {self._providers}")
            
            sess_options = ort.SessionOptions()
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            self._session = ort.InferenceSession(
                self._model_path,
                sess_options=sess_options,
                providers=self._providers
            )
            
            # Get input/output names
            self._input_name = self._session.get_inputs()[0].name
            self._output_name = self._session.get_outputs()[0].name
            
            # Log input shape
            input_shape = self._session.get_inputs()[0].shape
            logger.info(f"Model input shape: {input_shape}")
            logger.info(f"Model output: {self._output_name}")
            
            self._is_initialized = True
            logger.info("ArcFaceEmbedder initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ArcFaceEmbedder: {e}")
            raise RuntimeError(f"Model initialization failed: {e}")
    
    @property
    def is_ready(self) -> bool:
        """Check if embedder is ready for inference."""
        return self._is_initialized and self._session is not None
    
    def preprocess(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image matching client-side implementation.
        
        Preprocessing steps (matching Scan.jsx):
        1. Resize to 112x112
        2. BGR → RGB conversion
        3. Normalize: (x - 127.5) / 128
        4. HWC → CHW transpose
        5. Add batch dimension
        
        Args:
            image: BGR image from OpenCV (H, W, 3)
            
        Returns:
            Preprocessed tensor (1, 3, 112, 112) as float32
        """
        # 1. Resize to input size
        img = cv2.resize(
            image,
            (self.config.input_size, self.config.input_size),
            interpolation=cv2.INTER_LINEAR
        )
        
        # 2. BGR → RGB (OpenCV loads BGR, browser uses RGB)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # 3. Normalize: (x - 127.5) / 128 → range [-1, 1]
        img_norm = (img_rgb.astype(np.float32) - self.config.normalize_mean) / self.config.normalize_std
        
        # 4. HWC → CHW
        img_chw = np.transpose(img_norm, (2, 0, 1))
        
        # 5. Add batch dimension
        img_batch = np.expand_dims(img_chw, axis=0)
        
        return img_batch.astype(np.float32)
    
    @staticmethod
    def l2_normalize(vector: np.ndarray, eps: float = 1e-10) -> np.ndarray:
        """
        L2 normalize vector.
        
        Args:
            vector: Input vector
            eps: Small epsilon for numerical stability
            
        Returns:
            L2-normalized vector
        """
        norm = np.linalg.norm(vector)
        if norm > eps:
            return vector / norm
        return vector
    
    def get_embedding(
        self,
        image: np.ndarray,
        normalize: bool = True,
        skip_detection: bool = True  # Kept for backward compatibility
    ) -> Optional[np.ndarray]:
        """
        Extract embedding from face image.
        
        Args:
            image: BGR face image from OpenCV (cropped/aligned face)
            normalize: Whether to L2-normalize the output
            skip_detection: Ignored (kept for backward compatibility)
            
        Returns:
            L2-normalized embedding (512,) or None on error
        """
        if not self.is_ready:
            logger.error("Embedder not initialized")
            return None
        
        try:
            # Preprocess
            input_tensor = self.preprocess(image)
            
            # Run inference
            outputs = self._session.run(
                [self._output_name],
                {self._input_name: input_tensor}
            )
            
            # Extract and flatten embedding
            embedding = outputs[0].flatten()
            
            # L2 normalize
            if normalize:
                embedding = self.l2_normalize(embedding)
            
            return embedding.astype(np.float32)
            
        except Exception as e:
            logger.error(f"Embedding extraction failed: {e}")
            return None
    
    def get_embedding_result(
        self,
        image: np.ndarray,
        normalize: bool = True
    ) -> EmbeddingResult:
        """
        Extract embedding with detailed result information.
        
        Args:
            image: BGR face image from OpenCV
            normalize: Whether to L2-normalize the output
            
        Returns:
            EmbeddingResult with embedding and metadata
        """
        import time
        
        start_time = time.perf_counter()
        
        try:
            embedding = self.get_embedding(image, normalize)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            
            if embedding is not None:
                return EmbeddingResult(
                    embedding=embedding,
                    success=True,
                    processing_time_ms=elapsed_ms
                )
            else:
                return EmbeddingResult(
                    embedding=None,
                    success=False,
                    error_message="Embedding extraction returned None",
                    processing_time_ms=elapsed_ms
                )
                
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return EmbeddingResult(
                embedding=None,
                success=False,
                error_message=str(e),
                processing_time_ms=elapsed_ms
            )
    
    def get_embedding_from_file(
        self,
        image_path: Union[str, Path],
        normalize: bool = True
    ) -> Optional[np.ndarray]:
        """
        Extract embedding from image file.
        
        Args:
            image_path: Path to image file
            normalize: Whether to L2-normalize the output
            
        Returns:
            L2-normalized embedding (512,) or None on error
        """
        path = Path(image_path)
        if not path.exists():
            logger.error(f"Image file not found: {image_path}")
            return None
        
        image = cv2.imread(str(path))
        if image is None:
            logger.error(f"Failed to read image: {image_path}")
            return None
        
        return self.get_embedding(image, normalize)
    
    def get_embeddings_batch(
        self,
        images: List[np.ndarray],
        normalize: bool = True
    ) -> List[Optional[np.ndarray]]:
        """
        Extract embeddings from multiple images.
        
        Args:
            images: List of BGR face images
            normalize: Whether to L2-normalize outputs
            
        Returns:
            List of embeddings (some may be None on error)
        """
        return [self.get_embedding(img, normalize) for img in images]
    
    @staticmethod
    def cosine_similarity(
        emb1: np.ndarray,
        emb2: np.ndarray
    ) -> float:
        """
        Compute cosine similarity between two L2-normalized embeddings.
        
        For L2-normalized vectors, cosine similarity equals dot product.
        
        Args:
            emb1: First embedding (assumed L2-normalized)
            emb2: Second embedding (assumed L2-normalized)
            
        Returns:
            Cosine similarity in range [-1, 1]
        """
        return float(np.dot(emb1, emb2))
    
    def dispose(self) -> None:
        """Release resources."""
        self._session = None
        self._is_initialized = False
        logger.info("ArcFaceEmbedder disposed")


# ================= BACKWARD COMPATIBILITY =================

# Alias for backward compatibility
ArcFaceCustomEmbedder = ArcFaceEmbedder


# Singleton instance for easy access (backward compatible)
_embedder_instance: Optional[ArcFaceEmbedder] = None


def get_embedder(model_path: Optional[str] = None) -> ArcFaceEmbedder:
    """
    Get singleton instance of ArcFaceEmbedder.
    
    Backward compatible function.
    
    Args:
        model_path: Optional path to model file
        
    Returns:
        ArcFaceEmbedder instance
    """
    return ArcFaceEmbedder.get_instance(model_path=model_path)


def extract_embedding(
    image: np.ndarray,
    model_path: Optional[str] = None
) -> Optional[np.ndarray]:
    """
    Quick extraction of embedding from image.
    
    Convenience function for one-off extractions.
    
    Args:
        image: BGR face image
        model_path: Optional path to model
        
    Returns:
        L2-normalized embedding or None
    """
    embedder = get_embedder(model_path)
    return embedder.get_embedding(image)


# ================= CLI INTERFACE =================

def main():
    """Command-line interface for testing."""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(
        description="ArcFace Embedding Extractor"
    )
    parser.add_argument(
        "image",
        type=str,
        help="Path to face image"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to w600k_mbf.onnx model"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Verbose output"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    print(f"Processing: {args.image}")
    
    try:
        embedder = ArcFaceEmbedder(model_path=args.model)
        result = embedder.get_embedding_result(
            cv2.imread(args.image)
        )
        
        if result.success:
            print(f"✅ Success!")
            print(f"   Shape: {result.embedding.shape}")
            print(f"   Norm: {np.linalg.norm(result.embedding):.6f}")
            print(f"   Time: {result.processing_time_ms:.2f}ms")
            print(f"   First 5 values: {result.embedding[:5]}")
        else:
            print(f"❌ Failed: {result.error_message}")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
