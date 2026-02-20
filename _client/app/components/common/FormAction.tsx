import { Button } from '@/components/ui/button';

type FormActionProps = {
  onCancel: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  canSubmit?: boolean;
  cancelText?: string;
  submitText?: string;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
};

export function FormAction({
  onCancel,
  onSubmit,
  isLoading = false,
  canSubmit = true,
  cancelText = 'ยกเลิก',
  submitText = 'บันทึก',
  loadingText = 'กำลังบันทึก...',
  disabled = false,
  className = 'pt-4 flex justify-end gap-4',
}: FormActionProps) {
  const isSubmitDisabled = !canSubmit || isLoading || disabled;

  return (
    <section className={className}>
      <Button
        variant='outlinePrimary'
        onClick={onCancel}
        disabled={isLoading || disabled}
        className='w-32'
      >
        {cancelText}
      </Button>
      <Button onClick={onSubmit} disabled={isSubmitDisabled} className='w-32'>
        {isLoading ? loadingText : submitText}
      </Button>
    </section>
  );
}
