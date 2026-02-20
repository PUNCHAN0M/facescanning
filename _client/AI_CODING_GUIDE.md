# 🤖 AI Coding Guide - React Nest Template React

## 📋 Quick Reference

**Tech Stack:** React 19 + React Router 7 + React Query + Zustand + Zod + shadcn/ui + Tailwind  
**Architecture:** Feature-based monorepo with container development  
**Pattern:** Master Hook (Query), Type-safe validation, Centralized services

---

## 🏗️ Project Structure

```
client/app/
├── features/[feature_name]/
│   ├── pages/              # Route pages
│   ├── layouts/            # Feature layouts
│   ├── components/         # Feature components
│   ├── hooks/              # Master hooks (Query)
│   │   └── dev/            # Mock hooks for dev
│   ├── services/           # API services
│   │   └── dev/            # Mock services
│   ├── types/              # TypeScript types
│   ├── validations/        # Zod schemas
│   └── __mock__/           # Mock data JSON
├── components/             # Shared components
│   ├── common/             # Common components
│   ├── layout/             # Layout components
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Global hooks
├── services/               # API service factory
├── stores/                 # Global stores
├── constants/              # Routes, configs
└── lib/                    # Utilities

server/src/
├── (admin)/                # Admin modules
├── auth/                   # Auth module
├── core/                   # Core services
└── entities/               # Database entities
```

---

## 🎯 Core Templates

### 1. Types Pattern

```typescript
// types/example.ts
// * GET ALL / GET BY ID
export interface Example {
  id: string;
  title: string;
  description: string;
}

// * CREATE / UPDATE PAYLOAD
export interface ExamplePayload {
  title: string;
  description: string;
  isActive: boolean;
}

// * CUSTOM RESPONSE
export interface ExampleStats {
  totalItems: number;
  activeItems: number;
}

// * ENUMS
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}
```

### 2. Validation Pattern

```typescript
// validations/exampleValidation.ts
import { z } from 'zod';

export const exampleFormSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must not exceed 100 characters'),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must not exceed 500 characters'),

  isActive: z.boolean().default(true),
});

export type ExampleFormValues = z.infer<typeof exampleFormSchema>;
```

### 3. Service Pattern

```typescript
// services/exampleService.ts
import { createApiService } from '@/services/crud';

export const exampleApiService = createApiService<Example>('/example');

// * CUSTOM API CALLS
export const exampleCustomApiService = {
  async getStats(): Promise<{ data: ExampleStats }> {
    return exampleApiService.customGet('/stats');
  },

  // * RAW JSON BODY (default)
  async createCustom(data: ExamplePayload) {
    return exampleApiService.customPost('/custom', data);
  },

  // * FORM-DATA BODY
  async uploadWithFiles(data: ExamplePayload) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    return exampleApiService.customPost('/upload', formData);
  },
};
```

### 4. Master Hook Pattern

```typescript
// hooks/useExample.ts
import {
  useCreateEntity,
  useDeleteEntity,
  useEntityById,
  useEntityList,
  useUpdateEntity,
  useCustomQuery,
} from '@/hooks';

// * CRUD HOOKS
export const useExampleList = (params?: PaginationParams) => {
  return useEntityList('examples', exampleApiService, params);
};

export const useExampleById = (id: string) => {
  return useEntityById('examples', exampleApiService, id);
};

export const useCreateExample = () => {
  return useCreateEntity('examples', exampleApiService);
};

export const useUpdateExample = () => {
  return useUpdateEntity('examples', exampleApiService);
};

export const useDeleteExample = () => {
  return useDeleteEntity('examples', exampleApiService);
};

// * CUSTOM HOOKS
export const useExampleStats = () => {
  return useCustomQuery(['stats'], exampleCustomApiService.getStats);
};
```

### 5. Page Pattern

```tsx
// pages/ExamplePage.tsx
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function ExamplePage() {
  // * FILTER STATE
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // * DIALOG STATE
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Example | null>(null);

  // * PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // * DATA QUERY
  const { data, isLoading, error } = useExampleList({
    search: searchQuery,
    page: currentPage,
    limit: itemsPerPage,
  });

  const items = data?.data ?? [];
  const totalPages = data?.meta.totalPages ?? 1;

  // * ACTIONS
  const handleSearch = () => {
    setSearchQuery(searchTerm);
    setCurrentPage(1);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: Example) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  return (
    <section className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Example Page</CardTitle>
        </CardHeader>
        <CardContent>
          <Filter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearch={handleSearch}
            onClear={handleClear}
          />
          <ExampleTable
            items={items}
            isLoading={isLoading}
            error={error}
            onEdit={handleOpenEdit}
          />
          <AppPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </CardContent>
      </Card>
      <ExampleFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingItem={editingItem}
      />
    </section>
  );
}
```

### 6. Form Dialog Pattern

```tsx
// components/ExampleFormDialog.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

const defaultValues: ExampleFormValues = {
  title: '',
  description: '',
  isActive: true,
};

export function ExampleFormDialog({ isOpen, onClose, editingItem }: Props) {
  const createMutation = useCreateExample();
  const updateMutation = useUpdateExample();

  const form = useForm<ExampleFormValues>({
    resolver: zodResolver(exampleFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const isEditing = !!editingItem;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        form.reset({
          title: editingItem.title,
          description: editingItem.description,
          isActive: true,
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [editingItem, form, isOpen]);

  const handleSubmit = form.handleSubmit((data) => {
    if (isEditing && editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data },
        {
          onSuccess: () => {
            form.reset();
            onClose();
            // toast.success('Updated successfully');
          },
        },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          form.reset();
          onClose();
          // toast.success('Created successfully');
        },
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Example</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormAction
            onSubmit={handleSubmit}
            isEditing={isEditing}
            isLoading={isLoading}
            onCancel={onClose}
          />
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### 7. Table Pattern

```tsx
// components/ExampleTable.tsx
export function ExampleTable({ items, isLoading, error, onEdit }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allIds = useMemo(() => items.map((item) => item.id), [items]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : allIds);
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  if (isLoading) return <Loading />;
  if (error) return <Error error={error} />;
  if (!items.length) return NotFound('No items found');

  return (
    <Table>
      <TableHeader>
        <TableRow variant='header'>
          <TableHead>
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          </TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ExampleRow
            key={item.id}
            item={item}
            isSelected={selectedIds.includes(item.id)}
            onToggle={() => toggleOne(item.id)}
            onEdit={() => onEdit(item)}
          />
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## 🚨 Essential Rules

**✅ Always:**

- Use Zod for validation with clear error messages
- Follow feature-based folder structure
- Use Master Hook pattern (React Query)
- Handle loading/error states in components
- Reset form on dialog close
- Use TypeScript strict mode

**❌ Never:**

- Mutate state directly (React Query handles cache)
- Skip validation schemas
- Hardcode API endpoints (use service factory)
- Mix business logic in components

**Component Guidelines:**

- Complex/reusable → `components/` folder (e.g., `ExampleTable`)
- Feature-specific → `features/[name]/components/`
- Use `Loading`, `Error`, `NotFound` from `@/components/common`

**Development Workflow:**

- Use `dev/` folder for mock services when API not ready
- Switch import from `hooks/dev/useExample-dev` → `hooks/useExample` when API ready

---

## 📝 Quick Checklist

Creating a new feature? Follow this order:

1. **Types** (`types/`) - Define interfaces and enums
2. **Validation** (`validations/`) - Create Zod schemas
3. **Service** (`services/`) - Setup API calls (+ dev mock if needed)
4. **Hooks** (`hooks/`) - Create master hooks (+ dev mock if needed)
5. **Components** (`components/`) - Build reusable components
6. **Page** (`pages/`) - Compose page with state management
7. **Routes** (`routes.ts`) - Register routes

**Reference:** See `client/app/features/_example/` for complete implementation

---

For detailed examples, check `client/app/features/_example/` folder.
