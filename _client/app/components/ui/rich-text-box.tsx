'use client';

import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { useRef } from 'react';

import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Separator } from './separator';

type RichTextBoxProps = {
  title: string;
  placeholder?: string;
};

export default function RichTextBox({
  title,
  placeholder = '',
}: RichTextBoxProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  function exec(command: string, value?: string) {
    try {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
    } catch {
      // intentionally ignore command errors (unsupported in some browsers)
    }
  }

  return (
    <Card className='border-0 py-0 shadow-none'>
      <CardHeader className='px-0'>
        <CardTitle className='text-base font-medium'>{title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 rounded-md border px-0'>
        <div className='text flex items-center'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('undo')}
            aria-label='Undo'
          >
            <Undo2 className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('redo')}
            aria-label='Redo'
          >
            <Redo2 className='h-4 w-4' />
          </Button>
          <Separator orientation='vertical' className='mx-1 h-6' />
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('bold')}
            aria-label='Bold'
          >
            <Bold className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('italic')}
            aria-label='Italic'
          >
            <Italic className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('underline')}
            aria-label='Underline'
          >
            <Underline className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('strikeThrough')}
            aria-label='Strike'
          >
            <Strikethrough className='h-4 w-4' />
          </Button>
          <Separator orientation='vertical' className='mx-1 h-6' />
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('insertUnorderedList')}
            aria-label='UL'
          >
            <List className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('insertOrderedList')}
            aria-label='OL'
          >
            <ListOrdered className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => exec('formatBlock', 'blockquote')}
            aria-label='Quote'
          >
            <Quote className='h-4 w-4' />
          </Button>
        </div>
        <div
          ref={editorRef}
          className='min-h-54 w-full rounded-md px-3 text-sm focus:outline-none'
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
        >
          {placeholder}
        </div>
      </CardContent>
    </Card>
  );
}
