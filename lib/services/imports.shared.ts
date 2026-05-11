// Types and constants that are safe to import from client components.
// The implementation in imports.ts is server-only.

export type Match = {
  contactId: number;
  displayName: string;
  confidence: 'strong' | 'medium' | 'weak';
  reasons: string[];
  score: number;
};

export type ImportField =
  | 'skip'
  | 'displayName'
  | 'nickname'
  | 'phone'
  | 'email'
  | 'whatsapp'
  | 'wechat'
  | 'workCompany'
  | 'workTitle'
  | 'workTeam'
  | 'bio'
  | 'tags'
  | 'notes'
  | 'kid1Name'
  | 'kid1Grade'
  | 'kid1School'
  | 'kid1Sports'
  | 'kid2Name'
  | 'kid2Grade'
  | 'kid2School'
  | 'kid2Sports';

export const IMPORT_FIELDS: ReadonlyArray<{ value: ImportField; label: string }> = [
  { value: 'skip', label: '— Skip —' },
  { value: 'displayName', label: 'Name' },
  { value: 'nickname', label: 'Nickname' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'workCompany', label: 'Company / Org' },
  { value: 'workTitle', label: 'Title' },
  { value: 'workTeam', label: 'Team' },
  { value: 'bio', label: 'Bio' },
  { value: 'tags', label: 'Tags (comma sep)' },
  { value: 'notes', label: 'Notes' },
  { value: 'kid1Name', label: 'Kid 1 Name' },
  { value: 'kid1Grade', label: 'Kid 1 Grade' },
  { value: 'kid1School', label: 'Kid 1 School' },
  { value: 'kid1Sports', label: 'Kid 1 Sports' },
  { value: 'kid2Name', label: 'Kid 2 Name' },
  { value: 'kid2Grade', label: 'Kid 2 Grade' },
  { value: 'kid2School', label: 'Kid 2 School' },
  { value: 'kid2Sports', label: 'Kid 2 Sports' },
];

export type RowMapped = {
  displayName?: string;
  nicknames: string[];
  phone?: string;
  email?: string;
  workCompany?: string;
  workTitle?: string;
  workTeam?: string;
  bio?: string;
  tags: string[];
  notes: string[];
  handles: Array<{ platform: string; handle: string }>;
  kids: Array<{ name: string; grade?: string; school?: string; sports: string[] }>;
};

export type ReviewRow = {
  rowIndex: number;
  rowHash: string;
  raw: string[];
  mapped: RowMapped;
  matches: Match[];
  defaultStatus: 'auto_merge' | 'review' | 'create';
  defaultMatchId?: number;
};
