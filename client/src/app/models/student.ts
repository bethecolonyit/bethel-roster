export interface Student {
  id?: number;
  firstName: string;
  lastName: string;
  idNumber: string;
  counselor: string;
  program: string;
  dayin: string; // ISO date string
  dayout: string; // ISO date string
  isFelon: boolean;
  onProbation: boolean;
  usesNicotine: boolean;
  hasDriverLicense: boolean;
  foodAllergies: boolean;
  beeAllergies: boolean;

  roomNumber?: string;
  bedLetter?: string;


}