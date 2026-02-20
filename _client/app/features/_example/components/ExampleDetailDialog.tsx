import { Error, Loading, NotFound } from '@/components/common';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useExampleById } from '../hooks/dev/useExample-dev';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  id: string | null;
}

export function ExampleDetailDialog({ isOpen, onClose, id }: Props) {
  const { data, isLoading, error } = useExampleById(id || '');
  const example = data?.data ?? null;

  const renderGuard = () => {
    if (!id) return NotFound('ไม่พบข้อมูลไอดี');
    if (isLoading) return <Loading />;
    if (error) return <Error error={error} />;
    if (!example) return NotFound('ไม่พบข้อมูลตัวอย่าง');

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-h-screen overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold text-blue-600'>
            ตัวอย่างแสดงข้อมูล{' '}
            <span className='text-orange-500'>( GET BY ID )</span>
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className='sr-only' />
        {renderGuard() ||
          (example && (
            <section className='flex flex-col space-y-2'>
              <span className='font-semibold'>ID: {example.id}</span>
              <span className='font-semibold'>Title: {example.title}</span>
              <span className='font-semibold'>
                Description: {example.description}
              </span>
            </section>
          ))}
      </DialogContent>
    </Dialog>
  );
}
