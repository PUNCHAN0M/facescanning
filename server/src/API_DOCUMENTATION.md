# Face Scan API Documentation

API สำหรับระบบ Face Scan - จัดการบุคคล, กล้อง และการสแกนใบหน้า

## 🔗 Base URL

```
http://localhost:3000/api
```

## 🔐 Authentication

ใช้ JWT Bearer Token ในการ authentication

```
Authorization: Bearer <token>
```

---

## 📋 Table of Contents

- [Authentication](#authentication-endpoints)
- [Business Management](#business-endpoints)
- [People Management](#people-endpoints)
- [Camera Management](#camera-endpoints)
- [Detection Log Management](#detection-log-endpoints)

---

## Authentication Endpoints

### 1. Register (First Super Admin)

สร้าง Super Admin คนแรก (ผู้ใช้คนแรกที่ register จะได้ role SUPER_ADMIN อัตโนมัติ)

**Endpoint:** `POST /api/auth/register`

**Request Body:**

```json
{
  "email": "superadmin@example.com",
  "password": "password123",
  "firstName": "Super",
  "lastName": "Admin"
}
```

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "superadmin@example.com",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "SUPER_ADMIN",
    "createdAt": "2026-02-12T12:00:00.000Z"
  },
  "message": "First super admin created successfully"
}
```

### 2. Login

Login เข้าสู่ระบบ

**Endpoint:** `POST /api/auth/login`

**Request Body:**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "ADMIN",
    "businessId": "business-uuid",
    "business": {
      "id": "business-uuid",
      "name": "ABC Company"
    }
  }
}
```

### 3. Create User

สร้าง User ใหม่ (ต้อง login ก่อน)

**Endpoint:** `POST /api/auth/create-user` 🔒

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "email": "newadmin@example.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "ADMIN",
  "businessId": "business-uuid"
}
```

**Response:**

```json
{
  "id": "user-uuid",
  "email": "newadmin@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "ADMIN",
  "businessId": "business-uuid",
  "createdAt": "2026-02-12T12:00:00.000Z"
}
```

### 4. Get Profile

ดูข้อมูล Profile ของตัวเอง

**Endpoint:** `GET /api/auth/profile` 🔒

**Headers:**

```
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "user-uuid",
  "email": "admin@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "ADMIN",
  "businessId": "business-uuid",
  "business": {
    "id": "business-uuid",
    "name": "ABC Company",
    "description": "Company description"
  },
  "createdAt": "2026-02-12T12:00:00.000Z",
  "updatedAt": "2026-02-12T12:00:00.000Z"
}
```

---

## Business Endpoints

### 1. Create Business

สร้าง Business ใหม่ (SUPER_ADMIN only)

**Endpoint:** `POST /api/business` 🔒

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "name": "ABC Company",
  "description": "Company description"
}
```

**Response:**

```json
{
  "id": "business-uuid",
  "name": "ABC Company",
  "description": "Company description",
  "isActive": true,
  "createdAt": "2026-02-12T12:00:00.000Z",
  "updatedAt": "2026-02-12T12:00:00.000Z"
}
```

### 2. Get All Businesses

ดู Business ทั้งหมด

**Endpoint:** `GET /api/business` 🔒

- Super Admin: เห็นทั้งหมด
- Admin: เห็นเฉพาะของตัวเอง

**Response:**

```json
[
  {
    "id": "business-uuid",
    "name": "ABC Company",
    "description": "Company description",
    "isActive": true,
    "createdAt": "2026-02-12T12:00:00.000Z",
    "updatedAt": "2026-02-12T12:00:00.000Z",
    "_count": {
      "users": 5
    }
  }
]
```

### 3. Get Business by ID

ดูรายละเอียด Business

**Endpoint:** `GET /api/business/:id` 🔒

**Response:**

```json
{
  "id": "business-uuid",
  "name": "ABC Company",
  "description": "Company description",
  "isActive": true,
  "createdAt": "2026-02-12T12:00:00.000Z",
  "updatedAt": "2026-02-12T12:00:00.000Z",
  "users": [
    {
      "id": "user-uuid",
      "email": "admin@abc.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2026-02-12T12:00:00.000Z"
    }
  ]
}
```

### 4. Update Business

แก้ไข Business (SUPER_ADMIN only)

**Endpoint:** `PATCH /api/business/:id` 🔒

**Request Body:**

```json
{
  "name": "XYZ Company",
  "description": "Updated description"
}
```

### 5. Delete Business

ลบ Business (SUPER_ADMIN only)

**Endpoint:** `DELETE /api/business/:id` 🔒

---

## People Endpoints

### 1. Create Person

เพิ่มบุคคลใหม่

**Endpoint:** `POST /api/people` 🔒

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "email": "somchai@example.com",
  "phone": "0812345678",
  "position": "Software Engineer",
  "department": "IT Department",
  "employeeId": "EMP001",
  "description": "Senior developer",
  "faceImageFileNames": [
    "somchai_face_1.jpg",
    "somchai_face_2.jpg",
    "somchai_face_3.jpg"
  ]
}
```

**Response:**

```json
{
  "id": "person-uuid",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "email": "somchai@example.com",
  "phone": "0812345678",
  "position": "Software Engineer",
  "department": "IT Department",
  "employeeId": "EMP001",
  "description": "Senior developer",
  "isActive": true,
  "businessId": "business-uuid",
  "createdAt": "2026-02-12T12:00:00.000Z",
  "updatedAt": "2026-02-12T12:00:00.000Z",
  "business": {
    "id": "business-uuid",
    "name": "ABC Company"
  },
  "faceImages": [
    {
      "id": "image-uuid-1",
      "fileName": "somchai_face_1.jpg",
      "filePath": "/uploads/faces/business-uuid/somchai_face_1.jpg",
      "createdAt": "2026-02-12T12:00:00.000Z"
    },
    {
      "id": "image-uuid-2",
      "fileName": "somchai_face_2.jpg",
      "filePath": "/uploads/faces/business-uuid/somchai_face_2.jpg",
      "createdAt": "2026-02-12T12:00:00.000Z"
    }
  ]
}
```

### 2. Get All People

ดูบุคคลทั้งหมด

**Endpoint:** `GET /api/people` 🔒

- Super Admin: เห็นทั้งหมด
- Admin: เห็นเฉพาะใน Business ของตัวเอง

**Response:**

```json
[
  {
    "id": "person-uuid",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "email": "somchai@example.com",
    "position": "Software Engineer",
    "department": "IT Department",
    "employeeId": "EMP001",
    "businessId": "business-uuid",
    "business": {
      "id": "business-uuid",
      "name": "ABC Company"
    },
    "faceImages": [
      {
        "id": "image-uuid",
        "fileName": "somchai_face_1.jpg",
        "filePath": "/uploads/faces/business-uuid/somchai_face_1.jpg"
      }
    ]
  }
]
```

### 3. Get People by Business

ดูบุคคลตาม Business

**Endpoint:** `GET /api/people/business/:businessId` 🔒

### 4. Get Person by ID

ดูรายละเอียดบุคคล

**Endpoint:** `GET /api/people/:id` 🔒

### 5. Update Person

แก้ไขข้อมูลบุคคล

**Endpoint:** `PATCH /api/people/:id` 🔒

**Request Body:**

```json
{
  "position": "Senior Software Engineer",
  "department": "Engineering",
  "faceImageFileNames": ["somchai_new_1.jpg", "somchai_new_2.jpg"]
}
```

### 6. Delete Person

ลบบุคคล

**Endpoint:** `DELETE /api/people/:id` 🔒

### 7. Upload Face Images

อัพโหลดรูปใบหน้าจริง (รองรับหลายไฟล์)

**Endpoint:** `POST /api/people/:id/upload-faces` 🔒

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**

- `files`: ไฟล์รูปภาพ (รองรับ `.jpg`, `.jpeg`, `.png`, `.webp`)
- จำนวนไฟล์: สูงสุด 10 ไฟล์ต่อครั้ง
- ขนาดไฟล์: สูงสุด 5 MB ต่อไฟล์

**Example using cURL:**

```bash
curl -X POST http://localhost:3000/api/people/<person-id>/upload-faces \
  -H "Authorization: Bearer <token>" \
  -F "files=@face1.jpg" \
  -F "files=@face2.jpg" \
  -F "files=@face3.jpg"
```

**Response:**

```json
{
  "id": "person-uuid",
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "businessId": "business-uuid",
  "faceImages": [
    {
      "id": "image-uuid-1",
      "fileName": "1739369123456-face1.jpg",
      "filePath": "storage/business-uuid/people/person-uuid/1739369123456-face1.jpg",
      "fileSize": 2048576,
      "mimeType": "image/jpeg",
      "createdAt": "2026-02-12T12:00:00.000Z"
    },
    {
      "id": "image-uuid-2",
      "fileName": "1739369123457-face2.jpg",
      "filePath": "storage/business-uuid/people/person-uuid/1739369123457-face2.jpg",
      "fileSize": 1856342,
      "mimeType": "image/jpeg",
      "createdAt": "2026-02-12T12:00:01.000Z"
    }
  ]
}
```

**Storage Structure:**

ไฟล์จะถูกเก็บตามโครงสร้าง:

```
storage/
  └── {businessId}/
      └── people/
          └── {personId}/
              ├── 1739369123456-face1.jpg
              ├── 1739369123457-face2.jpg
              └── ...
```

### 8. Add Face Image

เพิ่มรูปใบหน้า (สำหรับเพิ่ม metadata อย่างเดียว)

**Endpoint:** `POST /api/people/:id/face-images` 🔒

**Request Body:**

```json
{
  "fileName": "somchai_face_4.jpg",
  "filePath": "/uploads/faces/business-uuid/somchai_face_4.jpg",
  "fileSize": 2048576,
  "mimeType": "image/jpeg"
}
```

### 9. Remove Face Image

ลบรูปใบหน้า

**Endpoint:** `DELETE /api/people/:personId/face-images/:imageId` 🔒

---

## Camera Endpoints

### 1. Create Camera

เพิ่มกล้องใหม่

**Endpoint:** `POST /api/cameras` 🔒

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "name": "Camera 1 - Main Entrance",
  "location": "Main Building - 1st Floor",
  "ipAddress": "192.168.1.100",
  "port": 554,
  "username": "admin",
  "password": "camera_password",
  "streamUrl": "rtsp://192.168.1.100:554/stream1",
  "description": "กล้องหน้าทางเข้าหลัก"
}
```

**Response:**

```json
{
  "id": "camera-uuid",
  "name": "Camera 1 - Main Entrance",
  "location": "Main Building - 1st Floor",
  "ipAddress": "192.168.1.100",
  "port": 554,
  "username": "admin",
  "streamUrl": "rtsp://192.168.1.100:554/stream1",
  "description": "กล้องหน้าทางเข้าหลัก",
  "isActive": true,
  "businessId": "business-uuid",
  "createdAt": "2026-02-12T12:00:00.000Z",
  "updatedAt": "2026-02-12T12:00:00.000Z",
  "business": {
    "id": "business-uuid",
    "name": "ABC Company"
  }
}
```

Note: `password` จะไม่ถูก return ในการ response เพื่อความปลอดภัย

### 2. Get All Cameras

ดูกล้องทั้งหมด

**Endpoint:** `GET /api/cameras` 🔒

- Super Admin: เห็นทั้งหมด
- Admin: เห็นเฉพาะใน Business ของตัวเอง

**Response:**

```json
[
  {
    "id": "camera-uuid",
    "name": "Camera 1 - Main Entrance",
    "location": "Main Building - 1st Floor",
    "ipAddress": "192.168.1.100",
    "port": 554,
    "username": "admin",
    "streamUrl": "rtsp://192.168.1.100:554/stream1",
    "isActive": true,
    "businessId": "business-uuid",
    "business": {
      "id": "business-uuid",
      "name": "ABC Company"
    }
  }
]
```

### 3. Get Cameras by Business

ดูกล้องตาม Business

**Endpoint:** `GET /api/cameras/business/:businessId` 🔒

### 4. Get Camera by ID

ดูรายละเอียดกล้อง

**Endpoint:** `GET /api/cameras/:id` 🔒

### 5. Update Camera

แก้ไขข้อมูลกล้อง

**Endpoint:** `PATCH /api/cameras/:id` 🔒

**Request Body:**

```json
{
  "name": "Camera 1 - Updated Name",
  "location": "New Location",
  "isActive": false
}
```

### 6. Delete Camera

ลบกล้อง

**Endpoint:** `DELETE /api/cameras/:id` 🔒

### 7. Toggle Camera Active Status

เปิด/ปิดการใช้งานกล้อง

**Endpoint:** `PATCH /api/cameras/:id/toggle` 🔒

**Response:**

```json
{
  "id": "camera-uuid",
  "name": "Camera 1 - Main Entrance",
  "isActive": false,
  ...
}
```

---

## Detection Log Endpoints

> **🔴 ฟีเจอร์ใหม่: ระบบบันทึกการสแกนใบหน้าพร้อม Redis Session (10 นาที Cooldown)**

ระบบ Detection Log จะป้องกันการสแกนซ้ำภายใน 10 นาที โดยใช้ Redis เก็บ session ของแต่ละคน

### 1. Create Detection Log

บันทึกการสแกนใบหน้า พร้อมอัพโหลดรูปภาพ (มี 10 นาที cooldown)

**Endpoint:** `POST /api/detection/log` 🔒

**Headers:**

```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**

- `personId`: UUID ของบุคคล (required)
- `cameraId`: UUID ของกล้อง (required)
- `confidence`: ค่าความมั่นใจ 0-1 (optional, เช่น 0.95)
- `image`: ไฟล์รูปภาพจากการสแกน (required, รองรับ .jpg, .jpeg, .png, .webp, สูงสุด 5 MB)

**Example using cURL:**

```bash
curl -X POST http://localhost:3000/api/detection/log \
  -H "Authorization: Bearer <token>" \
  -F "personId=person-uuid" \
  -F "cameraId=camera-uuid" \
  -F "confidence=0.95" \
  -F "image=@scan-result.jpg"
```

**Storage Structure:**

รูปภาพจะถูกเก็บตามโครงสร้าง:

```
storage/
  └── {businessId}/
      └── logs/
          └── {cameraId}/
              └── {personId}/
                  └── 2026-02-12T08-30-45-123Z.jpg
```

**Response (สำเร็จ):**

```json
{
  "id": "detection-log-uuid",
  "personId": "person-uuid",
  "cameraId": "camera-uuid",
  "businessId": "business-uuid",
  "imagePath": "storage/business-uuid/logs/camera-uuid/person-uuid/2026-02-12T08-30-45-123Z.jpg",
  "confidence": 0.95,
  "detectedAt": "2026-02-12T12:00:00.000Z",
  "person": {
    "id": "person-uuid",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "employeeId": "EMP001"
  },
  "camera": {
    "id": "camera-uuid",
    "name": "Camera 1 - Main Entrance",
    "location": "Main Building"
  },
  "business": {
    "id": "business-uuid",
    "name": "ABC Company"
  }
}
```

**Response (ถูกบล็อกเพราะสแกนซ้ำภายใน 10 นาที):**

```json
{
  "statusCode": 400,
  "message": "Person has already scanned recently. Please wait 9 minutes before scanning again.",
  "error": "Bad Request"
}
```

### 2. Get Detection Logs

ดูประวัติการสแกนทั้งหมด (มี filter)

**Endpoint:** `GET /api/detection/logs` 🔒

**Query Parameters:**

- `personId` (optional): กรองตาม Person ID
- `cameraId` (optional): กรองตาม Camera ID
- `businessId` (optional): กรองตาม Business ID (SUPER_ADMIN only)
- `startDate` (optional): วันที่เริ่มต้น (ISO format: `2026-02-01T00:00:00.000Z`)
- `endDate` (optional): วันที่สิ้นสุด (ISO format: `2026-02-28T23:59:59.999Z`)

**Example:**

```
GET /api/detection/logs?personId=xxx&startDate=2026-02-01T00:00:00.000Z&endDate=2026-02-28T23:59:59.999Z
```

**Response:**

```json
[
  {
    "id": "detection-log-uuid-1",
    "personId": "person-uuid",
    "cameraId": "camera-uuid",
    "businessId": "business-uuid",
    "imagePath": "storage/business-uuid/people/person-uuid/scan-1739369123456.jpg",
    "confidence": 0.95,
    "detectedAt": "2026-02-12T12:00:00.000Z",
    "person": {
      "id": "person-uuid",
      "firstName": "สมชาย",
      "lastName": "ใจดี",
      "employeeId": "EMP001"
    },
    "camera": {
      "id": "camera-uuid",
      "name": "Camera 1",
      "location": "Main Entrance"
    }
  },
  {
    "id": "detection-log-uuid-2",
    "personId": "person-uuid",
    "cameraId": "camera-uuid-2",
    "businessId": "business-uuid",
    "confidence": 0.92,
    "detectedAt": "2026-02-12T11:00:00.000Z",
    ...
  }
]
```

### 3. Get Detection Log by ID

ดูรายละเอียดการสแกนครั้งเดียว

**Endpoint:** `GET /api/detection/log/:id` 🔒

**Response:**

```json
{
  "id": "detection-log-uuid",
  "personId": "person-uuid",
  "cameraId": "camera-uuid",
  "businessId": "business-uuid",
  "imagePath": "storage/business-uuid/people/person-uuid/scan-1739369123456.jpg",
  "confidence": 0.95,
  "detectedAt": "2026-02-12T12:00:00.000Z",
  "person": {
    "id": "person-uuid",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "email": "somchai@example.com",
    "employeeId": "EMP001"
  },
  "camera": {
    "id": "camera-uuid",
    "name": "Camera 1 - Main Entrance",
    "location": "Main Building - 1st Floor",
    "ipAddress": "192.168.1.100"
  },
  "business": {
    "id": "business-uuid",
    "name": "ABC Company"
  }
}
```

### 4. Get Detection Stats

ดูสถิติการสแกนตาม Business

**Endpoint:** `GET /api/detection/stats/:businessId` 🔒

**Response:**

```json
{
  "businessId": "business-uuid",
  "businessName": "ABC Company",
  "totalScans": 1250,
  "uniquePeople": 85,
  "activeCameras": 5,
  "scansByCamera": [
    {
      "cameraId": "camera-uuid-1",
      "cameraName": "Camera 1 - Main Entrance",
      "scanCount": 450
    },
    {
      "cameraId": "camera-uuid-2",
      "cameraName": "Camera 2 - Back Door",
      "scanCount": 320
    }
  ],
  "scansByPerson": [
    {
      "personId": "person-uuid-1",
      "personName": "สมชาย ใจดี",
      "employeeId": "EMP001",
      "scanCount": 45
    },
    {
      "personId": "person-uuid-2",
      "personName": "สมหญิง รักดี",
      "employeeId": "EMP002",
      "scanCount": 42
    }
  ],
  "recentScans": [
    {
      "id": "detection-log-uuid",
      "personName": "สมชาย ใจดี",
      "cameraName": "Camera 1",
      "confidence": 0.95,
      "detectedAt": "2026-02-12T12:00:00.000Z"
    }
  ]
}
```

### 5. Check Scan Session

เช็คว่ามี session อยู่หรือไม่ (เหลือเวลา cooldown เท่าไหร่)

**Endpoint:** `GET /api/detection/check-session/:businessId/:cameraId/:personId` 🔒

**Response (ไม่มี session - สามารถสแกนได้):**

```json
{
  "hasSession": false,
  "message": "No active session. Scanning is allowed."
}
```

**Response (มี session - ต้องรอ):**

```json
{
  "hasSession": true,
  "remainingSeconds": 540,
  "remainingMinutes": 9,
  "message": "Active session found. Please wait 9 minutes before scanning again."
}
```

---

## 🆕 ฟีเจอร์ที่เพิ่มขึ้นมาใหม่

### 1. 🔴 Redis Session Management (10 นาที Cooldown)

- **เป้าหมาย**: ป้องกันการสแกนใบหน้าซ้ำภายใน 10 นาที
- **วิธีทำงาน**:
  1. เมื่อสแกนสำเร็จ → สร้าง session ใน Redis (TTL 600 วินาที)
  2. หากสแกนซ้ำภายใน 10 นาที → ระบบจะ reject พร้อมบอกเวลาที่เหลือ
  3. หลังจาก 10 นาที → session หมดอายุ สามารถสแกนได้ใหม่

- **Session Key Format**: `scan:session:{businessId}:{cameraId}:{personId}`
- **Session Data**: `{ detectionLogId, confidence, timestamp }`

### 2. 📊 Detection Log System

- **เป้าหมาย**: บันทึกประวัติการสแกนใบหน้าทั้งหมด
- **ข้อมูลที่เก็บ**:
  - Person (ใครถูกสแกน)
  - Camera (กล้องไหนสแกน)
  - Business (บริษัทไหน)
  - Image Path (ไฟล์รูปจากการสแกน)
  - Confidence Score (ค่าความมั่นใจ 0-1)
  - Timestamp (เวลาที่สแกน)

- **Features**:
  - ✅ กรองตามวันที่, Person, Camera, Business
  - ✅ ดูสถิติการสแกนแบบรวม
  - ✅ Role-based access control

### 3. 📁 Real File Upload System

- **เป้าหมาย**: อัพโหลดรูปใบหน้าจริงไปยัง server
- **โครงสร้างไฟล์**:

```
storage/
  └── {businessId}/
      └── people/
          └── {personId}/
              ├── timestamp-face1.jpg
              ├── timestamp-face2.jpg
              └── timestamp-scan-result.jpg
```

- **ข้อจำกัด**:
  - ไฟล์ละไม่เกิน 5 MB
  - รองรับเฉพาะ `.jpg`, `.jpeg`, `.png`, `.webp`
  - อัพโหลดสูงสุด 10 ไฟล์ต่อครั้ง

- **Features**:
  - ✅ Auto-generate unique filename (timestamp)
  - ✅ เก็บ metadata (fileName, filePath, fileSize, mimeType) ใน database
  - ✅ ลบไฟล์อัตโนมัติเมื่อลบ Person

---

## 🚀 Testing Workflow (Updated)

### Scenario 1: อัพโหลดรูปและบันทึกการสแกน

```bash
# 1. Login
POST /api/auth/login
{
  "email": "admin@abc.com",
  "password": "password123"
}

# 2. สร้าง Person
POST /api/people
{
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "employeeId": "EMP001"
}

# 3. อัพโหลดรูปใบหน้า
curl -X POST http://localhost:3000/api/people/<person-id>/upload-faces \
  -H "Authorization: Bearer <token>" \
  -F "files=@face1.jpg" \
  -F "files=@face2.jpg"

# 4. บันทึกการสแกนครั้งแรก พร้อมอัพโหลดรูปภาพ (สำเร็จ ✅)
curl -X POST http://localhost:3000/api/detection/log \
  -H "Authorization: Bearer <token>" \
  -F "personId=<person-id>" \
  -F "cameraId=<camera-id>" \
  -F "confidence=0.95" \
  -F "image=@scan-result.jpg"
# Response: 200 OK + Detection Log created
# File saved to: storage/{businessId}/logs/{cameraId}/{personId}/2026-02-12T08-30-45-123Z.jpg

# 5. พยายามสแกนซ้ำทันที (จะถูกบล็อก ❌)
curl -X POST http://localhost:3000/api/detection/log \
  -H "Authorization: Bearer <token>" \
  -F "personId=<person-id>" \
  -F "cameraId=<camera-id>" \
  -F "confidence=0.92" \
  -F "image=@scan-result-2.jpg"
# Response: ❌ "Please wait 10 minutes before scanning again."

# 6. เช็คสถานะ session
GET /api/detection/check-session/:businessId/:cameraId/:personId
# Response: { "hasSession": true, "remainingMinutes": 9 }

# 7. รอ 10 นาที หรือหลัง session หมดอายุ
# สแกนได้ใหม่ ✅
```

### Scenario 2: ดูสถิติและประวัติ

```bash
# 1. ดูประวัติการสแกนทั้งหมด
GET /api/detection/logs

# 2. กรองตาม Person
GET /api/detection/logs?personId=xxx

# 3. กรองตามวันที่
GET /api/detection/logs?startDate=2026-02-01T00:00:00.000Z&endDate=2026-02-28T23:59:59.999Z

# 4. ดูสถิติแบบรวม
GET /api/detection/stats/:businessId
```

---

## 🔒 Role-Based Access Control (Updated)

### SUPER_ADMIN สามารถ:

- ✅ สร้าง Business
- ✅ จัดการ Business ทั้งหมด
- ✅ สร้าง SUPER_ADMIN และ ADMIN
- ✅ เห็นข้อมูล People, Camera, Detection Logs ทั้งหมด

### ADMIN สามารถ:

- ✅ จัดการ People ใน Business ของตัวเอง
- ✅ จัดการ Camera ใน Business ของตัวเอง
- ✅ อัพโหลดรูปใบหน้า
- ✅ บันทึก Detection Log ใน Business ของตัวเอง
- ✅ ดูสถิติและประวัติการสแกนของ Business ตัวเอง
- ✅ สร้าง ADMIN คนอื่นใน Business เดียวกัน
- ❌ ไม่สามารถสร้าง Business
- ❌ ไม่เห็นข้อมูล Business อื่น

---

## 📊 Database Schema

### User

- id, email, password, firstName, lastName
- role (SUPER_ADMIN, ADMIN)
- businessId (nullable for SUPER_ADMIN)

### Business

- id, name, description, isActive
- Relations: users, people, cameras, detectionLogs

### Person

- id, firstName, lastName, email, phone
- position, department, employeeId, description, isActive
- businessId
- Relations: faceImages, detectionLogs

### FaceImage

- id, fileName, filePath, fileSize, mimeType
- personId
- Relations: person

### Camera

- id, name, location
- ipAddress, port, username, password
- streamUrl, description, isActive
- businessId
- Relations: detectionLogs

### DetectionLog (🆕)

- id, personId, cameraId, businessId
- imagePath, confidence
- detectedAt (timestamp)
- Relations: person, camera, business

---

## 🚀 Testing Workflow

### 1. Setup ครั้งแรก

```bash
# 1. Register Super Admin
POST /api/auth/register
{
  "email": "superadmin@example.com",
  "password": "password123",
  "firstName": "Super",
  "lastName": "Admin"
}

# 2. Login
POST /api/auth/login
{
  "email": "superadmin@example.com",
  "password": "password123"
}

# 3. Create Business
POST /api/business (with token)
{
  "name": "ABC Company",
  "description": "Test company"
}

# 4. Create Admin for Business
POST /api/auth/create-user (with token)
{
  "email": "admin@abc.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "ADMIN",
  "businessId": "<business-id>"
}
```

### 2. Admin เพิ่ม People และอัพโหลดรูป

```bash
# 1. Login as Admin
POST /api/auth/login
{
  "email": "admin@abc.com",
  "password": "password123"
}

# 2. Create Person
POST /api/people (with admin token)
{
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "employeeId": "EMP001",
  "position": "Software Engineer"
}

# 3. Upload Face Images
curl -X POST http://localhost:3000/api/people/<person-id>/upload-faces \
  -H "Authorization: Bearer <token>" \
  -F "files=@face1.jpg" \
  -F "files=@face2.jpg" \
  -F "files=@face3.jpg"
```

### 3. Admin เพิ่ม Camera

```bash
# Create Camera
POST /api/cameras (with admin token)
{
  "name": "Camera 1 - Main Entrance",
  "location": "Main Building",
  "ipAddress": "192.168.1.100",
  "port": 554,
  "streamUrl": "rtsp://192.168.1.100:554/stream1"
}
```

### 4. บันทึกการสแกนและทดสอบ Cooldown

```bash
# 1. บันทึกการสแกนครั้งแรก พร้อมอัพโหลดรูปภาพ (สำเร็จ ✅)
curl -X POST http://localhost:3000/api/detection/log \
  -H "Authorization: Bearer <token>" \
  -F "personId=<person-id>" \
  -F "cameraId=<camera-id>" \
  -F "confidence=0.95" \
  -F "image=@scan-result.jpg"
# Response: 200 OK + Detection Log created
# File saved to: storage/{businessId}/logs/{cameraId}/{personId}/2026-02-12T08-30-45-123Z.jpg

# 2. ทดสอบสแกนซ้ำทันที (ถูกบล็อก ❌)
curl -X POST http://localhost:3000/api/detection/log \
  -H "Authorization: Bearer <token>" \
  -F "personId=<person-id>" \
  -F "cameraId=<camera-id>" \
  -F "confidence=0.93" \
  -F "image=@scan-result-2.jpg"
# Response: 400 "Please wait 10 minutes before scanning again."

# 3. เช็คสถานะ session
GET /api/detection/check-session/:businessId/:cameraId/:personId
# Response: { "hasSession": true, "remainingMinutes": 9 }

# 4. ดูประวัติการสแกน
GET /api/detection/logs?personId=<person-id>

# 5. ดูสถิติ
GET /api/detection/stats/:businessId
```

---

## ⚠️ Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": ["Validation error messages"],
  "error": "Bad Request"
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "You can only access people within your business"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Person not found"
}
```

---

## 📝 Notes

- Password จะถูก hash ด้วย bcrypt ก่อนเก็บใน database
- JWT Token มีอายุ 7 วัน (configurable)
- Camera password จะไม่ถูก return ใน response
- Person และ Camera จะถูกลบแบบ CASCADE เมื่อ Business ถูกลบ
- Face Images จะถูกลบแบบ CASCADE เมื่อ Person ถูกลบ
- Detection Logs จะถูกลบแบบ CASCADE เมื่อ Business, Person, หรือ Camera ถูกลบ
- **Redis Session**: เก็บ session ของการสแกนเป็นเวลา 10 นาที (600 วินาที)
- **File Storage**: ไฟล์รูปภาพจะถูกเก็บใน `./storage/{businessId}/people/{personId}/`
- **File Validation**: รองรับเฉพาะ jpg, jpeg, png, webp (ไฟล์ละสูงสุด 5 MB)
- **Anti-Duplicate Scan**: ระบบจะป้องกันการสแกนซ้ำภายใน 10 นาที โดยอัตโนมัติ

---

## 🐳 Docker Services

### PostgreSQL

- **Port**: 5432
- **Database**: face_scan_db
- **User**: postgres
- **Password**: postgres123

### pgAdmin

- **URL**: http://localhost:5050
- **Email**: admin@admin.com
- **Password**: admin

### Redis

- **Port**: 6379
- **Password**: redis_password123
- **Purpose**: Session management (10-minute cooldown)

### Redis Commander

- **URL**: http://localhost:8081
- **Purpose**: GUI สำหรับดูข้อมูลใน Redis

---

## 🔧 Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/face_scan_db"

# JWT
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD="redis_password123"

# App
PORT=3000
NODE_ENV="development"
```
