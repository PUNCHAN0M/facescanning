import { NavigationIcon } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  siblingCount?: number;
  itemsPerPage?: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
}

export function AppPagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  siblingCount = 1,
  itemsPerPage = 5,
  onItemsPerPageChange,
  itemsPerPageOptions = [5, 10, 20, 50],
}: Props) {
  const [goToPage, setGoToPage] = useState('');

  if (totalPages <= 1 && !onItemsPerPageChange) return null;

  const getPageNumbers = (
    current: number,
    total: number,
    siblingCount: number = 1,
  ) => {
    const pages: (number | 'ellipsis')[] = [];
    const startPage = Math.max(2, current - siblingCount);
    const endPage = Math.min(total - 1, current + siblingCount);

    pages.push(1);
    if (startPage > 2) pages.push('ellipsis');
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    if (endPage < total - 1) pages.push('ellipsis');
    if (total > 1) pages.push(total);
    return pages;
  };

  const pageNumbers = getPageNumbers(currentPage, totalPages, siblingCount);

  const handleGoToPage = () => {
    const pageNum = parseInt(goToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setGoToPage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  return (
    <section className={cn('flex items-center justify-end gap-4', className)}>
      {/* PAGINATION CONTROL */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href='#'
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
                aria-disabled={currentPage === 1}
                className={
                  currentPage === 1
                    ? 'bg-muted text-muted-foreground pointer-events-none'
                    : ''
                }
              />
            </PaginationItem>
            {pageNumbers.map((page, idx) => (
              <PaginationItem key={idx}>
                {page === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href='#'
                    isActive={currentPage === page}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page !== currentPage) onPageChange(Number(page));
                    }}
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href='#'
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                aria-disabled={currentPage === totalPages}
                className={
                  currentPage === totalPages
                    ? 'bg-muted text-muted-foreground pointer-events-none'
                    : ''
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Go TO PAGE */}
      {totalPages > 1 && (
        <section className='flex items-center gap-4'>
          <Input
            type='number'
            min={1}
            max={totalPages}
            value={goToPage}
            onChange={(e) => setGoToPage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder='Go to'
            className='w-20'
          />
          <Button
            onClick={handleGoToPage}
            disabled={
              !goToPage ||
              parseInt(goToPage) < 1 ||
              parseInt(goToPage) > totalPages
            }
          >
            <NavigationIcon />
          </Button>
        </section>
      )}

      {/* ITEMS PER PAGE SELECTOR */}
      {onItemsPerPageChange && (
        <section className='flex items-center gap-4'>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
          >
            <SelectTrigger className='w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itemsPerPageOptions.map((option) => (
                <SelectItem key={option} value={option.toString()}>
                  {option} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      )}
    </section>
  );
}
