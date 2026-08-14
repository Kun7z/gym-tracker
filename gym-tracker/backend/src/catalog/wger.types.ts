export interface WgerPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface WgerEquipment {
  id: number;
  name: string;
}

export interface WgerMuscle {
  id: number;
  name: string;
  name_en: string;
  is_front: boolean;
}

export interface WgerCategory {
  id: number;
  name: string;
}

export interface WgerLanguage {
  id: number;
  short_name: string;
  full_name: string;
}

export interface WgerTranslationInfo {
  id: number;
  uuid: string;
  name: string;
  language: number;
}

export interface WgerExerciseInfo {
  id: number;
  uuid: string;
  category: WgerCategory;
  muscles: WgerMuscle[];
  muscles_secondary: WgerMuscle[];
  equipment: WgerEquipment[];
  license_author: string | null;
  variation_group: string | null;
  images: { image: string | null; is_main: boolean }[];
  translations: WgerTranslationInfo[];
}

export interface WgerDeletionLog {
  model_type: string;
  uuid: string;
  replaced_by: string | null;
  timestamp: string;
  comment: string | null;
}
