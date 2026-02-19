/**
 * APIService - Production-ready API service for face scanning backend
 * 
 * Handles all HTTP communications with the FastAPI backend server.
 * Implements proper error handling, request throttling, and response validation.
 * 
 * @author FaceScanning Team
 * @version 2.0.0
 */

/* ================= CONFIGURATION ================= */
export const APIConfig = Object.freeze({
  BASE_URL: "http://localhost:8000",
  TIMEOUT_MS: 30000,
  RETRY_COUNT: 3,
  RETRY_DELAY_MS: 1000,
  SEARCH_THROTTLE_MS: 700
});

/* ================= ERROR CLASSES ================= */
export class APIError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = "NetworkError";
    this.originalError = originalError;
  }
}

/* ================= API SERVICE CLASS ================= */
export class APIService {
  constructor(baseUrl = APIConfig.BASE_URL) {
    this.baseUrl = baseUrl;
    this.lastSearchTime = 0;
    this.isSearching = false;
    this.abortControllers = new Map();
  }

  /**
   * Generic fetch wrapper with error handling and timeout
   */
  async request(endpoint, options = {}) {
    const {
      method = "GET",
      body = null,
      headers = {},
      timeout = APIConfig.TIMEOUT_MS,
      signal = null
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Store abort controller for potential cancellation
    const requestId = `${method}-${endpoint}-${Date.now()}`;
    this.abortControllers.set(requestId, controller);

    try {
      const fetchOptions = {
        method,
        headers: {
          ...headers
        },
        signal: signal || controller.signal
      };

      if (body) {
        if (body instanceof FormData) {
          fetchOptions.body = body;
        } else {
          fetchOptions.headers["Content-Type"] = "application/json";
          fetchOptions.body = JSON.stringify(body);
        }
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new APIError(
          errorData?.detail || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw new NetworkError("Request timeout or cancelled");
      }
      if (error instanceof APIError) {
        throw error;
      }
      throw new NetworkError(error.message, error);
    } finally {
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  /* ================= ORGANIZE ENDPOINTS ================= */

  /**
   * Get all organizes
   */
  async getOrganizes() {
    const data = await this.request("/organizes");
    return data.organizes || [];
  }

  /**
   * Get organize details with members
   */
  async getOrganizeDetails(organizeName) {
    if (!organizeName) {
      throw new Error("Organization name is required");
    }
    const data = await this.request(
      `/organize/${encodeURIComponent(organizeName)}/details`
    );
    return {
      members: data.members || [],
      stats: data.stats || {}
    };
  }

  /**
   * Create new organize
   */
  async createOrganize(organizeName) {
    if (!organizeName?.trim()) {
      throw new Error("Organization name is required");
    }
    return await this.request(
      `/organize/create?organize_name=${encodeURIComponent(organizeName)}`,
      { method: "POST" }
    );
  }

  /**
   * Rename organize
   */
  async renameOrganize(oldName, newName) {
    if (!oldName || !newName?.trim()) {
      throw new Error("Both old and new names are required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(oldName)}/rename?new_name=${encodeURIComponent(newName.trim())}`,
      { method: "PUT" }
    );
  }

  /**
   * Delete organize
   */
  async deleteOrganize(organizeName) {
    if (!organizeName) {
      throw new Error("Organization name is required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}`,
      { method: "DELETE" }
    );
  }

  /* ================= MEMBER ENDPOINTS ================= */

  /**
   * Add member to organize
   */
  async addMember(organizeName, personName) {
    if (!organizeName || !personName?.trim()) {
      throw new Error("Organization and person names are required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}/member?person_name=${encodeURIComponent(personName)}`,
      { method: "POST" }
    );
  }

  /**
   * Rename member
   */
  async renameMember(organizeName, oldName, newName) {
    if (!organizeName || !oldName || !newName?.trim()) {
      throw new Error("All names are required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}/member/${encodeURIComponent(oldName)}/rename?new_name=${encodeURIComponent(newName.trim())}`,
      { method: "PUT" }
    );
  }

  /**
   * Delete member
   */
  async deleteMember(organizeName, personName) {
    if (!organizeName || !personName) {
      throw new Error("Organization and person names are required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}/member/${encodeURIComponent(personName)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Get member images
   */
  async getMemberImages(organizeName, personName) {
    if (!organizeName || !personName) {
      throw new Error("Organization and person names are required");
    }
    const data = await this.request(
      `/organize/${encodeURIComponent(organizeName)}/member/${encodeURIComponent(personName)}/images`
    );
    return data.images || [];
  }

  /**
   * Upload member image
   */
  async uploadMemberImage(organizeName, personName, file) {
    if (!organizeName || !personName || !file) {
      throw new Error("Organization, person name, and file are required");
    }
    
    const formData = new FormData();
    formData.append("file", file);
    
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}/member/${encodeURIComponent(personName)}/upload`,
      { method: "POST", body: formData }
    );
  }

  /**
   * Delete member image
   */
  async deleteMemberImage(organizeName, personName, filename) {
    if (!organizeName || !personName || !filename) {
      throw new Error("All parameters are required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}/member/${encodeURIComponent(personName)}/image/${encodeURIComponent(filename)}`,
      { method: "DELETE" }
    );
  }

  /**
   * Get image URL
   */
  getImageUrl(organizeName, personName, filename) {
    return `${this.baseUrl}/organize/${encodeURIComponent(organizeName)}/member/${encodeURIComponent(personName)}/image/${encodeURIComponent(filename)}`;
  }

  /* ================= VECTOR ENDPOINTS ================= */

  /**
   * Rebuild vectors for organize
   */
  async rebuildVectors(organizeName) {
    if (!organizeName) {
      throw new Error("Organization name is required");
    }
    return await this.request(
      `/organize/${encodeURIComponent(organizeName)}/rebuild`,
      { method: "POST", timeout: 120000 } // Extended timeout for vector rebuild
    );
  }

  /**
   * Search face by embedding vector
   * Implements throttling to prevent overwhelming the server
   */
  async searchByEmbedding(organizeName, embedding, k = 1) {
    if (!organizeName) {
      throw new Error("Organization name is required");
    }
    if (!embedding || embedding.length === 0) {
      throw new Error("Valid embedding is required");
    }

    // Throttle search requests
    const now = performance.now();
    if (this.isSearching || now - this.lastSearchTime < APIConfig.SEARCH_THROTTLE_MS) {
      return null;
    }

    this.lastSearchTime = now;
    this.isSearching = true;

    try {
      const data = await this.request(
        `/organize/${encodeURIComponent(organizeName)}/search_vector`,
        {
          method: "POST",
          body: {
            embedding: Array.isArray(embedding) ? embedding : Array.from(embedding),
            k
          }
        }
      );

      if (data.status === "success") {
        return {
          person: data.person || null,
          similarity: typeof data.similarity === "number" ? data.similarity : null,
          status: "success"
        };
      }
      
      return {
        person: null,
        similarity: null,
        status: "no_match"
      };
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * Reset search throttle state
   */
  resetSearchThrottle() {
    this.lastSearchTime = 0;
    this.isSearching = false;
  }
}

/* ================= SINGLETON INSTANCE ================= */
let apiInstance = null;

export function getAPIService(baseUrl) {
  if (!apiInstance) {
    apiInstance = new APIService(baseUrl);
  }
  return apiInstance;
}

export default APIService;
