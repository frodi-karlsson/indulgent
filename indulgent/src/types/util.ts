export type WithoutEmptyObject<T> = keyof T extends never ? never : T;
