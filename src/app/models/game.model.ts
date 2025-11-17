export type Category = 'Ação'|'RPG'|'Estratégia'|'Esporte'|'Simulação'|'Outro';

export interface Rating {
  value: number;
  userId: number;
}

export interface Game {
  id?: number;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  category: Category;
  ratings?: Rating[];
  userIds?: number[];
}
