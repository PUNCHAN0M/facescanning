import { useMemo } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { FormAction } from '../FormAction';

interface DeletableItem {
  id: string;
  label: string;
  isUse?: boolean;
}

type Props<T extends DeletableItem> = {
  isOpen: boolean;
  onClose: () => void;
  itemsToDelete?: T[];
  onDelete: (items: T[]) => Promise<void>;
  isLoading?: boolean;
  title?: string;
  itemType?: string;
  deletableText?: string;
  blockedText?: string;
  confirmText?: string;
  checkUsageStatus?: boolean;
};

export function DeleteDialog<T extends DeletableItem>({
  isOpen,
  onClose,
  itemsToDelete = [],
  onDelete,
  isLoading = false,
  title = 'ยืนยันการลบ',
  itemType = 'รายการ',
  deletableText = 'รายการที่สามารถลบได้',
  blockedText = 'ไม่สามารถลบรายการต่อไปนี้ได้ (กำลังใช้งานอยู่)',
  confirmText = 'การลบไม่สามารถย้อนคืนได้',
  checkUsageStatus = false,
}: Props<T>) {
  const items = useMemo(() => itemsToDelete ?? [], [itemsToDelete]);

  const deletableItems = useMemo(() => {
    if (!checkUsageStatus) {
      return items;
    }

    return items.filter((item) => !item.isUse);
  }, [items, checkUsageStatus]);

  const blockedItems = useMemo(() => {
    if (!checkUsageStatus) {
      return [];
    }
    return items.filter((item) => item.isUse);
  }, [items, checkUsageStatus]);

  const isMultiple = items.length > 1;
  const canDelete = deletableItems.length > 0;
  const hasBlockedItems = blockedItems.length > 0;

  const handleDelete = async () => {
    if (!canDelete) return;
    await onDelete(deletableItems);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* LIST */}
        <section className='space-y-4'>
          {items.length === 0 ? (
            <span>ไม่มี{itemType}ที่จะลบ</span>
          ) : (
            <>
              <p className='text-muted-foreground text-sm'>
                {isMultiple
                  ? `คุณต้องการลบ ${items.length} ${itemType}หรือไม่?`
                  : `คุณต้องการลบ${itemType} "${items[0]?.label}" หรือไม่?`}
              </p>

              {canDelete && (
                <section className='space-y-2'>
                  <p className='text-sm font-medium text-green-600'>
                    {deletableText}: ({deletableItems.length})
                  </p>
                  <article className='max-h-32 overflow-y-auto rounded border p-2'>
                    {deletableItems.map((item) => (
                      <span key={item.id} className='py-1 text-sm'>
                        • {item.label} <br />
                      </span>
                    ))}
                  </article>
                </section>
              )}

              {hasBlockedItems && (
                <section className='space-y-2'>
                  <p className='text-sm font-medium text-red-600'>
                    {blockedText}: ({blockedItems.length})
                  </p>
                  <article className='max-h-32 overflow-y-auto rounded border bg-red-50 p-2'>
                    {blockedItems.map((item) => (
                      <span key={item.id} className='py-1 text-sm text-red-700'>
                        • {item.label} <br />
                      </span>
                    ))}
                  </article>
                </section>
              )}

              <DialogDescription className='text-muted-foreground pt-1 text-sm'>
                {confirmText}
              </DialogDescription>
            </>
          )}

          {/* ACTION */}
          <FormAction
            onCancel={onClose}
            onSubmit={handleDelete}
            isLoading={isLoading}
            canSubmit={canDelete}
            submitText='ลบ'
            loadingText='กำลังลบ...'
          />
        </section>
      </DialogContent>
    </Dialog>
  );
}
