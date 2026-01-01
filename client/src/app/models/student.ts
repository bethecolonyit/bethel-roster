export interface StudentBase {
  firstName: string;
  lastName: string;
  idNumber: string;
  counselor: string;
  program: string;
  dayin: string;
  dayout: string;
  isFelon: boolean;
  onProbation: boolean;
  usesNicotine: boolean;
  hasDriverLicense: boolean;
  foodAllergies: boolean;
  beeAllergies: boolean;

  // plus any other fields you have (roomNumber/bedLetter/buildingName/totalDemerits, etc.)
}

export interface Student extends StudentBase {
  id: number; // ✅ persisted entity
}

export type StudentDraft = StudentBase; // ✅ no id until DB creates it