import { SearchIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  // * SEARCH
  showSearch?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  searchPlaceholder?: string;

  // * URL SEARCH
  showUrlSearch?: boolean;
  urlSearchTerm?: string;
  onUrlSearchTermChange?: (value: string) => void;
  urlSearchPlaceholder?: string;

  // * FILTER

  // * ACTION
  onSearch?: () => void;
  onClear?: () => void;
  showSearchButton?: boolean;
};

export function Filter({
  // * SEARCH
  showSearch = false,
  searchTerm = '',
  onSearchTermChange,
  searchPlaceholder = 'Placeholder',

  // * URL SEARCH
  showUrlSearch = false,
  urlSearchTerm = '',
  onUrlSearchTermChange,
  urlSearchPlaceholder = 'URL',

  // * FILTER

  // * ACTION
  onSearch,
  onClear,
  showSearchButton = true,
}: Props) {
  return (
    <section className='flex w-full flex-col'>
      <article className='flex items-center gap-4'>
        {/* SEARCH */}
        {showSearch && (
          <section className='flex w-full flex-col gap-0.5'>
            <span className='text-start font-light'>คำค้นหา</span>
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchTermChange?.(e.target.value)}
            />
          </section>
        )}

        {/* URL SEARCH */}
        {showUrlSearch && (
          <section className='flex w-full flex-col gap-0.5'>
            <span className='text-start font-light'>URL</span>
            <Input
              placeholder={urlSearchPlaceholder}
              value={urlSearchTerm}
              onChange={(e) => onUrlSearchTermChange?.(e.target.value)}
            />
          </section>
        )}

        {/* ACTION BUTTON */}
        {onClear && (
          <Button
            variant='outline'
            className='text-muted-foreground mt-auto w-3xs'
            onClick={onClear}
          >
            ล้างข้อมูล
          </Button>
        )}

        {showSearchButton && onSearch && (
          <Button
            className='mt-auto w-3xs gap-0.5'
            disabled={!searchTerm && !urlSearchTerm}
            onClick={onSearch}
          >
            <SearchIcon />
            ค้นหา
          </Button>
        )}
      </article>

      {/* SHADOW LINE */}
      <div className='mt-2 rounded-b-sm pt-2 shadow-[0_4px_4px_rgba(0,0,0,0.075)]' />
    </section>
  );
}
