export type Category = {
  id: number;
  name: string;
  icon: string | null;
  user_id: number | null;
};

export type CategoryWriteInput = {
  name: string;
  icon: string | null;
};
