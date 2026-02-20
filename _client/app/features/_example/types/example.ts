// * GET ALL GET BY ID
export interface Example {
  id: string;
  title: string;
  description: string;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  STAFF = 'staff',
}

// * CREATE UPDATE
export interface ExamplePayload {
  title: string;
  description: string;

  username: string;
  email: string;
  displayName: string;
  nameSurname: string;
  phoneNumber: string;
  role: UserRole;
  interestedTopic: string;
  note: string;
  isActive: boolean;
}

// * SPECIFIC
export interface ExampleStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
}
