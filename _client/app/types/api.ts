// * API Response Types

// * GetAll
export interface ApiPaginatedResponse<T = unknown> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message: string; // * 'Success' // ! 'Error'
  success: boolean; // * true // ! false
}

// * GetById, Create, Update, Delete
export interface ApiResponse<T = unknown> {
  /*
   * ข้อมูลที่คืนจาก API
   * - GET (เช่น getById): มักจะมี data เสมอ
   * - CREATE, UPDATE, DELETE: โดยทั่วไปจะไม่มี data (อาจเป็น undefined/null)
   *   ยกเว้นกรณีที่ API ต้องการคืนข้อมูลใหม่ เช่น id ที่ถูกสร้าง หรือข้อมูลที่ backend ปรับแต่ง
   * - การคืน data ขึ้นอยู่กับความจำเป็นของแต่ละ API endpoint
   */
  data: T;
  message: string; // * 'Success' // ! 'Error'
  success: boolean; // * true // ! false
}

// * API Request Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
