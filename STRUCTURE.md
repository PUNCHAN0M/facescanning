```
server/
├── data/
│   ├── organize1/
│   │   ├── faces/                ← โฟลเดอร์เก็บภาพใบหน้าของแต่ละบุคคล
│   │   │   ├── boom/             ← โฟลเดอร์ของบุคคล "boom"
│   │   │   │   ├── image1.png
│   │   │   │   ├── image2.jpg
│   │   │   │   └── image3.jpeg
│   │   │   ├── korn/
│   │   │   └── suton/
│   │   └── vector/             ← โฟลเดอร์เก็บเวกเตอร์ (เช่น meta.npy, index.faiss)
│   │      ├── index.faiss
│   │      └── meta.npy             ← โฟลเดอร์เก็บเวกเตอร์ (เช่น .npy, index.faiss)
│   │
│   └── pupa/
│       ├── faces/
│       │   ├── pun/
│       │   │   ├── img01.png
│       │   │   └── selfie.jpg
│       │   ├── ball/
│       │   └── ton/
│       └── vector/             ← เวกเตอร์เฉพาะของ organize "pupa"
│
├── app.py
├── arcface.py
├── cropped_face.py
├── embedding.py
├── structure_data.py            ← ไฟล์ class FaceDataManager ที่เราเขียน
├── requirements.txt
├── README.md
└── STRUCTURE.md                 ← ไฟล์นี้ (เอกสารโครงสร้างโปรเจกต์)
```

#structure_data.py
```
    python structure_data.py create pupa ton

    # ลบ
    python structure_data.py remove pupa ton

    # ดูว่ามี organize อะไรบ้าง
    python structure_data.py list-organizes

    # ดูว่าใน 'pupa' มีใครบ้าง
    python structure_data.py list-persons pupa

    # ดูว่า 'ton' ใน 'pupa' มีกี่รูป
    python structure_data.py count-faces pupa ton
```

#vector_data.py
```
    # สร้าง embedding ทั้ง organize
    python vector_data.py pupa --embed

    # ดูรายชื่อ person
    python vector_data.py pupa --list

    # นับจำนวน person
    python vector_data.py pupa --count

    # นับจำนวน vector ต่อ person
    python vector_data.py pupa --count-vectors
```
