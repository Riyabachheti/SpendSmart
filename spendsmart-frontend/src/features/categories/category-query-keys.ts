export const categoryQueryKeys = {
  all: (userId: number) => ["categories", userId] as const,
};
