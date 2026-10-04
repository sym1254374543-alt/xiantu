export type TextReplaceRuleMode = 'regex' | 'text';

export type TextReplaceRule = {
  id: string;
  enabled: boolean;
  mode: TextReplaceRuleMode;
  pattern: string;
  replacement: string;
  ignoreCase?: boolean;
  global?: boolean;
  multiline?: boolean;
  dotAll?: boolean;
};

