// * LIBRARY IMPORT
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

// * GLOBAL IMPORT
import { AppPagination, Error, Loading, NotFound } from '@/components/common';
import { Filter } from '@/components/common/Filter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// * LOCAL IMPORT
import { ExampleDeleteDialog } from '../components/ExampleDeleteDialog';
import { ExampleDetailDialog } from '../components/ExampleDetailDialog';
import { ExampleFormDialog } from '../components/ExampleFormDialog';
import { ExampleTable } from '../components/ExampleTable';
import { useExampleList } from '../hooks/dev/useExample-dev'; // * dev ไว้สำหรับเขียนแสดงผลก่อน กรณีที่ api ยังไม่เสร็จแล้วหน้าบ้านต้องการแสดงผล ในเขียน function ตามไฟล์นี้
// * import { useExampleList } from '../hooks/useExample'; สำหรับเรียก API จริง ให้ดูตัวอย่างการเขียนตามไฟล์นี้
import type { Example } from '../types/example';

import type { Route } from './+types/ExamplePage';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'Example - React Nest Template' },
    { name: 'description', content: 'Example Overview' },
  ];
}

export default function ExamplePage() {
  // * FILTER STATE
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // * DIALOG
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailExample, setDetailExample] = useState<string | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingExample, setEditingExample] = useState<Example | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [examplesToDelete, setExamplesToDelete] = useState<Example[]>([]);

  // * PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // * DATA QUERY
  const {
    data: exampleData,
    isLoading,
    error,
  } = useExampleList({
    search: searchQuery,
    page: currentPage,
    limit: itemsPerPage,
  });
  const examples = exampleData?.data ?? [];
  const totalPages = exampleData?.meta.totalPages ?? 1;

  const lastUpdated: string = '6/10/2025';

  // * FILTER ACTION
  const handleSearch = () => {
    setSearchQuery(searchTerm);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearchTerm('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // * PAGINATION ACTION
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // * DETAIL DIALOG ACTION
  const handleOpenDetailDialog = (id: string) => {
    setDetailExample(id);
    setIsDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailExample(null);
    setIsDetailDialogOpen(false);
  };

  // * CREATE EDIT DIALOG ACTION
  const handleOpenCreateDialog = () => {
    setEditingExample(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (example: Example) => {
    setEditingExample(example);
    setIsFormDialogOpen(true);
  };

  const handleCloseFormDialog = () => {
    setEditingExample(null);
    setIsFormDialogOpen(false);
  };

  // * DELETE DIALOG ACTION
  const handleOpenDeleteSingle = (example: Example) => {
    setExamplesToDelete([example]);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenDeleteBulk = () => {
    const selectedExamples = examples.filter((example) =>
      selectedIds.includes(example.id),
    );
    setExamplesToDelete(selectedExamples);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setExamplesToDelete([]);
    setSelectedIds([]);
    setIsDeleteDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-semibold'>
          Example Preview
        </CardTitle>
        <CardDescription>
          <span className='mt-2 text-gray-600'>
            ตัวอย่างสำหรับไกด์วิธีการเขียนโค้ด รูปแบบการเขียน เพื่อให้ project
            มีความ consistency
          </span>
          <br />
          <span className='text-sm text-gray-500'>
            อัปเดตล่าสุด: {lastUpdated}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* FILTER */}
        <SectionCard title='ตัวอย่างฟิลเตอร์' subtitle='FILTER'>
          <Filter
            showSearch
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder='ตัวอย่าง'
            onSearch={handleSearch}
            onClear={handleClear}
          />
        </SectionCard>

        {/* CREATE AND DELETE */}
        <SectionCard
          title='ตัวอย่างการเพิ่มข้อมูล และลบข้อมูล'
          subtitle='CREATE AND DELETE'
          contentClassName='space-x-4'
        >
          <Button className='w-32 gap-0.5' onClick={handleOpenCreateDialog}>
            <Plus />
            เพิ่ม...
          </Button>
          <ExampleFormDialog
            isOpen={isFormDialogOpen}
            onClose={handleCloseFormDialog}
            editingExample={editingExample}
          />

          <Button
            className='w-32 gap-0.5'
            onClick={handleOpenDeleteBulk}
            disabled={selectedIds.length <= 0}
          >
            <Trash2 />
            ลบข้อมูล ({selectedIds.length})
          </Button>

          <ExampleDeleteDialog
            isOpen={isDeleteDialogOpen}
            onClose={handleCloseDeleteDialog}
            examplesToDelete={examplesToDelete}
          />
        </SectionCard>

        {/* GET ALL GET BY ID UPDATE AND DELETE */}
        <SectionCard
          title='ตัวอย่างการแสดงผลข้อมูลทั้งหมด แก้ไขข้อมูล และลบข้อมูล'
          subtitle='GET ALL, GET BY ID, UPDATE AND DELETE'
        >
          <ExampleTable
            examples={examples}
            isLoading={isLoading}
            error={error}
            searchQuery={searchQuery}
            onDetailExample={handleOpenDetailDialog}
            onEditExample={handleOpenEditDialog}
            onDeleteExample={handleOpenDeleteSingle}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
          />

          <ExampleDetailDialog
            isOpen={isDetailDialogOpen}
            onClose={handleCloseDetailDialog}
            id={detailExample}
          />
        </SectionCard>

        {/* PAGINATION */}
        <SectionCard title='ตัวอย่าง' subtitle='PAGINATION'>
          <AppPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            itemsPerPageOptions={[5, 10, 20, 50]}
          />
        </SectionCard>

        {/* LOADING NOT FOUND AND ERROR */}
        <SectionCard
          title='ตัวอย่าง'
          subtitle='LOADING, NOT FOUND AND ERROR'
          contentClassName='flex justify-between'
        >
          <Loading />
          {NotFound('ไม่พบข้อมูลตัวอย่าง')}
          <Error error={error} />
        </SectionCard>
      </CardContent>
    </Card>
  );
}

interface SectionCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  contentClassName?: string;
}

function SectionCard({
  title,
  subtitle,
  children,
  contentClassName,
}: SectionCardProps) {
  return (
    <Card>
      <CardHeader className='pb-0'>
        <CardTitle className='text-left text-lg font-semibold text-blue-600'>
          {title} <span className='text-orange-500'>( {subtitle} )</span>
        </CardTitle>
        <CardDescription className='sr-only' />
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
