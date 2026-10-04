import type { MemoryFormatConfig } from '@/utils/memoryFormatConfig';

export interface Memory {
  type: 'short' | 'medium' | 'long' | 'implicit';
  content: string;
  time: string;
  parsedContent?: {
    title?: string;
    sections: { [key: string]: string[] };
    format?: MemoryFormatConfig;
  };
  originalIndex?: number;
  isConverted?: boolean;
  importance?: number;
}
