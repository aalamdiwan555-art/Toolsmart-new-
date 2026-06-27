export interface ToolItem {
  slug: string;
  title: string;
  category: string;
  description: string;
}

export type CategoryType = 'all' | 'converters' | 'math' | 'finance' | 'content' | 'developer' | 'security';
