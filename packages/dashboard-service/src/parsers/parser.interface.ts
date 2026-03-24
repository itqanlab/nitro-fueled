export interface FileParser<T> {
  canParse(filePath: string): boolean;
  parse(content: string, filePath: string): T;
}
