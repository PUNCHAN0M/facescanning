import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { FormAction } from '@/components/common/FormAction';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { useCreateExample, useUpdateExample } from '../hooks/useExample';
import type { Example } from '../types/example';
import { UserRole } from '../types/example';
import {
  exampleFormSchema,
  type ExampleFormValues,
} from '../validations/exampleValidation';

const defaultFormValues: ExampleFormValues = {
  title: '',
  description: '',
  username: '',
  email: '',
  displayName: '',
  nameSurname: '',
  phoneNumber: '',
  role: UserRole.USER,
  interestedTopic: '',
  note: '',
  isActive: true,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editingExample?: Example | null;
}

export function ExampleFormDialog({ isOpen, onClose, editingExample }: Props) {
  const createExampleMutation = useCreateExample();
  const updateExampleMutation = useUpdateExample();

  const form = useForm<ExampleFormValues>({
    resolver: zodResolver(exampleFormSchema),
    defaultValues: defaultFormValues,
    mode: 'onChange',
  });
  const isEditing = !!editingExample;
  const isLoading =
    createExampleMutation.isPending || updateExampleMutation.isPending;
  const isDataValid = form.formState.isValid;
  const canSubmit = isDataValid && !isLoading;

  useEffect(() => {
    if (isOpen) {
      if (editingExample) {
        // * UPDATE
        form.reset({
          // * DATA จริงควรใส่ครบทุกอย่าง ในตัวอย่างจะใส่แค่ title กับ description
          ...defaultFormValues,
          title: editingExample.title || '',
          description: editingExample.description || '',
        });
      } else {
        // * CREATE
        form.reset(defaultFormValues);
      }
    }
  }, [editingExample, form, isOpen]);

  const handleSubmit = form.handleSubmit((data: ExampleFormValues) => {
    if (isEditing && editingExample) {
      updateExampleMutation.mutate(
        { id: editingExample.id, data },
        {
          onSuccess: () => {
            form.reset();
            onClose();
          },
          onError: () => {
            toast.error('Failed to update example');
          },
        },
      );
    } else {
      const randomId = Math.random().toString(36).substring(2, 12);
      createExampleMutation.mutate(
        { data: { ...data, id: randomId } },
        {
          onSuccess: () => {
            form.reset();
            onClose();
          },
          onError: () => {
            toast.error('Failed to create example');
          },
        },
      );
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-h-screen overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold text-blue-600'>
            {isEditing ? (
              <>
                ฟอร์มแก้ไขตัวอย่าง{' '}
                <span className='text-orange-500'>( UPDATE )</span>
              </>
            ) : (
              <>
                ฟอร์มเพิ่มตัวอย่าง{' '}
                <span className='text-orange-500'>( CREATE )</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogDescription>
          <span className='text-gray-600'>
            ตัวอย่างฟอร์มการเพิ่มหรือแก้ไขข้อมูล
          </span>
        </DialogDescription>

        {/* CORE FORM */}
        <Form {...form}>
          {/* TITLE FIELD */}
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input placeholder='title' {...field} />
                </FormControl>
                <FormDescription>{/* TODO: */}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* DESCRIPTION FIELD */}
          <FormField
            control={form.control}
            name='description'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descriptions *</FormLabel>
                <FormControl>
                  <Input placeholder='description' {...field} />
                </FormControl>
                <FormDescription>{/* TODO: */}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* USERNAME FIELD */}
          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username *</FormLabel>
                <FormControl>
                  <Input placeholder='john_doe' {...field} />
                </FormControl>
                <FormDescription>
                  This will be your unique identifier in the system.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* EMAIL FIELD */}
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address *</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder='john@example.com'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  We'll use this email to send you notifications.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* DISPLAY NAME FIELD */}
          <FormField
            control={form.control}
            name='displayName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name *</FormLabel>
                <FormControl>
                  <Input placeholder='John Doe' {...field} />
                </FormControl>
                <FormDescription>
                  This is how your name will appear to other users.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* FULL NAME FIELD */}
          <FormField
            control={form.control}
            name='nameSurname'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder='John Michael Doe' {...field} />
                </FormControl>
                <FormDescription>
                  Your complete legal name (optional).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* PHONE NUMBER FIELD */}
          <FormField
            control={form.control}
            name='phoneNumber'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder='+1 (555) 123-4567' {...field} />
                </FormControl>
                <FormDescription>
                  Your contact phone number (optional).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ROLE FIELD */}
          <FormField
            control={form.control}
            name='role'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select a role' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={UserRole.USER}>User</SelectItem>
                    <SelectItem value={UserRole.STAFF}>Staff</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Select your role in the system.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* RESEARCH INTEREST FIELD */}
          <FormField
            control={form.control}
            name='interestedTopic'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Research Interests</FormLabel>
                <FormControl>
                  <Input
                    placeholder='Historical documents, manuscripts, etc.'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  What topics or areas are you interested in researching?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* NOTES FIELD */}
          <FormField
            control={form.control}
            name='note'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Any additional information about yourself...'
                    className='min-h-20'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Feel free to add any additional information about yourself.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ACTIVE STATUS FIELD */}
          <FormField
            control={form.control}
            name='isActive'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className='space-y-1 leading-none'>
                  <FormLabel>Active Account</FormLabel>
                  <FormDescription>
                    Check this box to enable the user account. Unchecked
                    accounts will be disabled and cannot log in.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {/* ACTION */}
          <FormAction
            onCancel={() => {
              form.reset();
              onClose();
            }}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            canSubmit={canSubmit}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}
