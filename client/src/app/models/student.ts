export interface Student {
  id?: number;
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

  roomNumber?: string;
  bedLetter?: string;


}