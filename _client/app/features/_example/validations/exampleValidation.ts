import { z } from 'zod';

import { UserRole } from '../types/example';

export const exampleFormSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),

  description: z
    .string()
    .min(1, 'Description is required')
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must not exceed 500 characters'),

  username: z
    .string()
    .min(1, 'Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens',
    ),

  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must not exceed 255 characters'),

  displayName: z
    .string()
    .min(1, 'Display name is required')
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must not exceed 100 characters'),

  nameSurname: z
    .string()
    .max(150, 'Full name must not exceed 150 characters')
    .optional()
    .or(z.literal('')),

  phoneNumber: z
    .string()
    .regex(
      /^(\+?[0-9]{1,4})?[\s.-]?\(?[0-9]{1,4}\)?[\s.-]?[0-9]{1,4}[\s.-]?[0-9]{1,9}$/,
      'Please enter a valid phone number',
    )
    .max(20, 'Phone number must not exceed 20 characters')
    .optional()
    .or(z.literal('')),

  role: z.nativeEnum(UserRole, {
    required_error: 'Please select a role',
    invalid_type_error: 'Invalid role selected',
  }),

  interestedTopic: z
    .string()
    .max(200, 'Research interests must not exceed 200 characters')
    .optional()
    .or(z.literal('')),

  note: z
    .string()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),

  isActive: z.boolean(),
});

export type ExampleFormValues = z.infer<typeof exampleFormSchema>;
