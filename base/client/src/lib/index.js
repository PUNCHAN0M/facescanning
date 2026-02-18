/**
 * Client Library Index
 * 
 * Export all services for easy importing
 */

export { 
  FaceDetectionService, 
  getFaceDetectionService,
  FaceDetectionConfig,
  MathUtils 
} from "./FaceDetectionService";

export { 
  FaceAlignmentService, 
  getFaceAlignmentService 
} from "./FaceAlignmentService";

export { 
  EmbeddingService, 
  getEmbeddingService 
} from "./EmbeddingService";

export { 
  APIService, 
  getAPIService,
  APIConfig,
  APIError,
  NetworkError 
} from "./APIService";
