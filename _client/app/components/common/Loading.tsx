import { Card, CardContent } from '@/components/ui/card';

export function Loading() {
  return (
    <Card>
      <CardContent className='flex min-w-46 flex-col items-center justify-center'>
        <div className='border-t-primary border-muted mt-6 mb-4 size-10 animate-spin rounded-full border-5' />
        <span className='text-primary ml-1 text-lg font-semibold'>
          กำลังโหลด...
        </span>
      </CardContent>
    </Card>
  );
}
