export type DataRetentionConfig = {
  enabled: boolean;
  models: 'all' | string[];
  periods: string;
  policy: string;
};
