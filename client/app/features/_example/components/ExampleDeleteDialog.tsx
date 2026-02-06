import { DeleteDialog } from '@/components/common/dialog';

import { useBulkDeleteExample, useDeleteExample } from '../hooks/useExample';
import type { Example } from '../types/example';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  examplesToDelete?: Example[];
};

export function ExampleDeleteDialog({
  isOpen,
  onClose,
  examplesToDelete = [],
}: Props) {
  const deleteExampleMutation = useDeleteExample();
  const bulkDeleteExampleMutation = useBulkDeleteExample();

  const isLoading =
    deleteExampleMutation.isPending || bulkDeleteExampleMutation.isPending;

  const deletableItems = examplesToDelete.map((example) => ({
    ...example,
    label: example.title,
  }));

  const handleDelete = async (examles: Example[]) => {
    if (examles.length === 1) {
      await deleteExampleMutation.mutateAsync({ id: examles[0].id });
    } else {
      const ids = examles.map((example) => example.id);
      await bulkDeleteExampleMutation.mutateAsync({ ids });
    }
  };

  return (
    <DeleteDialog
      isOpen={isOpen}
      onClose={onClose}
      itemsToDelete={deletableItems}
      onDelete={handleDelete}
      isLoading={isLoading}
      title='ยืนยันการลบ'
      itemType='ตัวอย่าง'
      deletableText='ตัวอย่างที่สามารถลบได้'
      blockedText='ไม่สามารถลบตัวอย่างต่อไปนี้ได้ (กำลังใช้งานอยู่)'
      checkUsageStatus={true}
    />
  );
}
