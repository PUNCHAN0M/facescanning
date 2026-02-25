export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Landmark {
  x: number;
  y: number;
}

export interface FaceDetection {
  bbox: BoundingBox | number[];
  landmarks?: Landmark[];
  conf: number;
}

export interface DetectionResult {
  status: 'success' | 'unknown' | 'no_face' | 'error';
  person?: string;
  similarity?: number;
  confirmed_person?: string;
  message?: string;
}

export interface Organize {
  name: string;
}

export interface Member {
  person_name: string;
  image_count: number;
  vector_count: number;
}

export interface MemberImage {
  filename: string;
  url: string;
}

export interface OrganizeDetails {
  members: Member[];
}

export interface UploadResponse {
  message: string;
  detail?: string;
}
