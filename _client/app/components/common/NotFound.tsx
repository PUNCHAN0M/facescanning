import { FiSearch } from 'react-icons/fi';

import { Card, CardContent } from '@/components/ui/card';

export function NotFound(text: string) {
  return (
    <Card>
      <CardContent className='flex min-w-46 flex-col items-center justify-center'>
        <FiSearch className='mt-6 mr-1.5 mb-3 text-5xl text-yellow-500' />
        <span className='text-lg font-semibold text-yellow-600'>
          ไม่พบข้อมูล
        </span>
        <span className='text-warning mt-1'>{text}</span>
      </CardContent>
    </Card>
  );
}
