export interface ForEacher<T> {
    forEach(callback: (element: T) => void): void;
}