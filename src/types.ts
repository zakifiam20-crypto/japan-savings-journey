export type Transaction = {
  id: string;
  user_name: string;
  amount: number;
  date: string;
  proof_image_url: string | null;
  created_at: string;
};

export type User = 'Fiam Zaki' | 'Ario Maulana';

export const GOAL_AMOUNT = 50000000; // Rp 50.000.000
export const INDIVIDUAL_GOAL = 25000000; // Rp 25.000.000 each
