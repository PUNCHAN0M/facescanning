import { FiAlertCircle } from 'react-icons/fi';

import { Card, CardContent } from '@/components/ui/card';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Error(error: any) {
  return (
    <Card className='border-red-200'>
      <CardContent className='flex min-w-46 flex-col items-center justify-center'>
        <FiAlertCircle className='mt-6 mb-4 text-5xl text-red-500' />
        <span className='text-lg font-semibold text-red-600'>
          เกิดข้อผิดพลาด
        </span>
        {error && <span className='text-error mt-1'>{error.message}</span>}
      </CardContent>
    </Card>
  );
}
