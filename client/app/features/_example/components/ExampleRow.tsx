import { Eye, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';

import { type Example } from '../types/example';

type Props = {
  example: Example;
  isSelected?: boolean;
  onToggle?: () => void;
  onDetail?: (id: string) => void;
  onEdit?: (example: Example) => void;
  onDelete?: (example: Example) => void;
};

export default function ExampleRow({
  example,
  isSelected = false,
  onToggle = () => null,
  onDetail,
  onEdit,
  onDelete,
}: Props) {
  return (
    <TableRow key={example.id}>
      <TableCell>
        <div className='ml-2 flex items-center'>
          <Checkbox
            aria-label={`select-${example.id}`}
            className='mr-3 size-6'
            checked={isSelected}
            onCheckedChange={onToggle}
          />
          <span>{example.title}</span>
        </div>
      </TableCell>
      <TableCell>
        <section className='flex h-full items-center justify-center gap-1'>
          <Button
            variant='ghost'
            className='size-8'
            onClick={() => onDetail?.(example.id)}
          >
            <Eye className='text-primary' />
          </Button>
          <Button
            variant='ghost'
            className='size-8'
            onClick={() => onEdit?.(example)}
          >
            <Pencil className='text-primary' />
          </Button>
          <Button
            variant='ghost'
            className='size-8'
            onClick={() => onDelete?.(example)}
          >
            <Trash2 className='text-primary' />
          </Button>
        </section>
      </TableCell>
    </TableRow>
  );
}
