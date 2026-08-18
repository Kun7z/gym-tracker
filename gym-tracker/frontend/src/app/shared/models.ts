/** Contratos da API (espelham os DTOs do backend NestJS). */

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  weightUnit: string;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}

export interface CatalogEquipment {
  id: number;
  name: string;
  slug: string;
}

export interface CatalogMuscle {
  id: number;
  name: string;
  nameEn: string | null;
}

export interface CatalogCategory {
  id: number;
  name: string;
  slug: string;
}

export interface CatalogExercise {
  id: string;
  wgerUuid: string;
  name: string;
  nameEn: string | null;
  variationGroup: string | null;
  imageUrl: string | null;
  licenseAuthor: string | null;
  category: { id: number; name: string };
  equipment: { id: number; name: string; slug: string }[];
  muscles: { id: number; name: string; nameEn: string | null }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

export interface WorkoutSet {
  id: string;
  clientUuid: string;
  exerciseId: string;
  exercise: { id: string; name: string; wgerUuid: string } | null;
  weightKg: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
  isBodyweight: boolean;
  performedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSetPayload {
  clientUuid: string;
  exerciseId: string;
  weightKg?: number;
  reps: number;
  rpe?: number;
  notes?: string;
  isBodyweight?: boolean;
  performedAt?: string;
}

export interface HistoryPoint {
  date: string;
  maxWeightKg: number | null;
  volumeKg: number | null;
  maxE1rmKg: number | null;
  setsCount: number;
}

export interface ExerciseHistory {
  exercise: { id: string; name: string; wgerUuid: string };
  tz: string;
  points: HistoryPoint[];
}

export interface ExerciseSummary {
  exercise: { id: string; name: string; wgerUuid: string };
  totalSets: number;
  lastUsedAt: string | null;
  daysSinceLastUse: number | null;
  bestWeightKg: number | null;
  bestE1rmKg: number | null;
  firstBestWeightKg: number | null;
  lastBestWeightKg: number | null;
}
