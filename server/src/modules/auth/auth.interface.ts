import { Business, User as PrismaUser } from '@prisma/client';

export interface User extends PrismaUser {
  business: Business | null;
}
