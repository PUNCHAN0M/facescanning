import { useCallback, useMemo, useState } from 'react';

import { Error, Loading, NotFound } from '@/components/common';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { Example } from '../types/example';

import ExampleRow from './ExampleRow';

type Props = {
  examples: Example[];
  isLoading: boolean;
  error: unknown;
  searchQuery: string;
  onDetailExample: (id: string) => void;
  onEditExample?: (example: Example) => void;
  onDeleteExample?: (example: Example) => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
};

export function ExampleTable({
  examples,
  isLoading,
  error,
  searchQuery,
  onDetailExample,
  onEditExample,
  onDeleteExample,
  selectedIds: externalSelectedIds,
  onSelectedIdsChange,
}: Props) {
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);

  const selectedIds = externalSelectedIds ?? internalSelectedIds;

  const allIds = useMemo(() => examples.map((k) => k.id), [examples]);

  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selectedIds.includes(id)),
    [allIds, selectedIds],
  );

  const someSelected = useMemo(
    () => selectedIds.length > 0 && !allSelected,
    [selectedIds, allSelected],
  );

  const toggleAll = useCallback(() => {
    const newSelectedIds = allSelected ? [] : allIds.slice();
    if (onSelectedIdsChange) {
      onSelectedIdsChange(newSelectedIds);
    } else {
      setInternalSelectedIds(newSelectedIds);
    }
  }, [allSelected, allIds, onSelectedIdsChange]);

  const onToggleOne = useCallback(
    (id: string) => {
      if (onSelectedIdsChange) {
        const newSelectedIds = selectedIds.includes(id)
          ? selectedIds.filter((p) => p !== id)
          : [...selectedIds, id];
        onSelectedIdsChange(newSelectedIds);
      } else {
        setInternalSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
        );
      }
    },
    [selectedIds, onSelectedIdsChange],
  );

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <Error error={error} />;
  }

  if ((!examples || examples.length === 0) && searchQuery) {
    return NotFound('ไม่พบข้อมูลตัวอย่าง');
  }

  return (
    <Table>
      <TableHeader>
        <TableRow variant='header'>
          <TableHead className='pl-4'>
            <div className='flex items-center'>
              <Checkbox
                aria-label='select-all'
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={toggleAll}
                className='mr-3 size-6'
              />
              <span>ตัวอย่าง</span>
            </div>
          </TableHead>
          <TableHead className='w-32 text-center'>ดำเนินการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {examples.map((example) => (
          <ExampleRow
            key={example.id}
            example={example}
            isSelected={selectedIds.includes(example.id)}
            onToggle={() => onToggleOne(example.id)}
            onDetail={onDetailExample}
            onEdit={onEditExample}
            onDelete={onDeleteExample}
          />
        ))}
      </TableBody>
    </Table>
  );
}
