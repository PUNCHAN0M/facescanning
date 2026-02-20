import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '@/common/modules/prisma/prisma.service';

import { LoginDto, RegisterDto } from './dto/auth.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (first user is SUPER_ADMIN, others need to be created by SUPER_ADMIN)
    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? Role.SUPER_ADMIN : Role.ADMIN;

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      user,
      message:
        role === Role.SUPER_ADMIN
          ? 'First super admin created successfully'
          : 'User registered successfully',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        business: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      businessId: user.businessId,
    };

    const accessToken = this.jwtService.sign(payload);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  async createUser(createUserDto: CreateUserDto, currentUser: User) {
    const { email, password, firstName, lastName, role, businessId } =
      createUserDto;

    // Check permissions
    if (currentUser.role === Role.SUPER_ADMIN) {
      // Super admin can create both admins and super admins
      // If creating admin, must provide businessId
      if (role === Role.ADMIN && !businessId) {
        throw new BadRequestException(
          'Business ID is required when creating an admin',
        );
      }

      // If creating super admin, businessId should not be provided
      if (role === Role.SUPER_ADMIN && businessId) {
        throw new BadRequestException(
          'Super admin cannot be assigned to a business',
        );
      }
    } else if (currentUser.role === Role.ADMIN) {
      // Admin can only create admins within their own business
      if (role !== Role.ADMIN) {
        throw new ForbiddenException('Admin can only create other admins');
      }

      if (!currentUser.businessId) {
        throw new ForbiddenException(
          'You must be assigned to a business to create users',
        );
      }

      if (businessId && businessId !== currentUser.businessId) {
        throw new ForbiddenException(
          'You can only create users within your own business',
        );
      }
    } else {
      throw new ForbiddenException(
        'You do not have permission to create users',
      );
    }

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        businessId:
          role === Role.ADMIN ? businessId || currentUser.businessId : null,
        createdById: currentUser.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        businessId: true,
        createdAt: true,
      },
    });

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        businessId: true,
        business: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
