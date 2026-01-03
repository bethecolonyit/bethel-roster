import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { Students } from './components/students/students';
import { authGuard } from './guards/auth-guard';
import { UsersComponent } from './components/users/users'; 
import { adminGuard } from './guards/admin-guard';           
import { Residential } from './components/residential/residential';
import { ViewStudent } from './components/students/view-student/view-student';
import { CCoordDashboard } from './components/departments/c-coord/c-coord-dashboard/c-coord-dashboard';
import { hrGuard } from './guards/hr-guard';
import { ProjectOfficeDashboard } from './components/departments/project_office/project-office-dashboard/project-office-dashboard';
import { OfficeDashboard } from './components/departments/office/office-dashboard/office-dashboard';
import { CounselingDashboard } from './components/departments/counseling/counseling-dashboard/counseling-dashboard';
import { CreateWritingAssignment } from './components/writing-assignments/create-writing-assignment/create-writing-assignment';
import { ManageEmployees } from './components/employees/manage-employees/manage-employees';
import { HrDashboardComponent } from './components/departments/hr/hr-dashboard/hr-dashboard';
import { StaffTimeOffComponent } from './components/employees/staff-time-off/staff-time-off';
import { counselingcoordinatorGuard } from './guards/counseling_coordinator-guard';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },

  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
  },
  {
    path: 'students',
    component: Students,
    canActivate: [authGuard],
  },
  {
    path: 'students/create-writing-assignment/:id',
    component: CreateWritingAssignment,
    canActivate: [authGuard],
  },
  {
    path: 'students/view/:id',
    component: ViewStudent,
    canActivate: [authGuard],
  },
  {
    path: 'users',
    component: UsersComponent,
    canActivate: [adminGuard],   // only admins
  },
  {
    path: 'residential',
    component: Residential,
    canActivate: [adminGuard],  
  },
  {
    path: 'departments/c-coord-dashboard',
    component: CCoordDashboard,
    canActivate: [counselingcoordinatorGuard],
  },
  {
    path: 'departments/counseling',
    component: CounselingDashboard,
    canActivate: [adminGuard],
  },
  {
    path: 'departments/project-office',
    component: ProjectOfficeDashboard,
    canActivate: [adminGuard],
  },
  {
    path: 'departments/office',
    component: OfficeDashboard,
    canActivate: [adminGuard],
  },
  {
    path: 'departments/hr',
    component: HrDashboardComponent,
    canActivate: [hrGuard],
  },
  {
    path: 'employees',
    component: ManageEmployees,
    canActivate: [adminGuard],
  },
  {
    path: 'employees/me',
    component: StaffTimeOffComponent,
    canActivate: [authGuard],
  },

  { path: '**', redirectTo: 'login' },
];
