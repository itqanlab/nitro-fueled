export type FileChangeEvent = 'add' | 'change' | 'unlink';

export interface FileWatcher {
  watch(directory: string, onChange: (path: string, event: FileChangeEvent) => void): void;
  close(): Promise<void>;
}
