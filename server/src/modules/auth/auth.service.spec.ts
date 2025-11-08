import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { Customer } from '@/entities/customer.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Role } from '@/entities/role.entity';
import { RoleEnum } from '@/common/types/role.enum';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
    let service: AuthService;
    let customerRepository: any;
    let internalRepository: any;
    let doctorRepository: any;
    let roleRepository: any;
    let jwtService: JwtService;
    let configService: ConfigService;

    const mockCustomer = {
        id: 'customer-1',
        email: 'customer@test.com',
        full_name: 'Test Customer',
        password: 'hashedPassword',
        isActive: true,
    };

    const mockInternal = {
        id: 'internal-1',
        email: 'admin@test.com',
        full_name: 'Test Admin',
        password: 'hashedPassword',
        isActive: true,
        role: { name: 'admin' },
    };

    const mockDoctor = {
        id: 'doctor-1',
        email: 'doctor@test.com',
        full_name: 'Test Doctor',
        password: 'hashedPassword',
        isActive: true,
    };

    const mockRole = {
        id: 1,
        name: 'admin',
        description: 'System administrator',
    };

    beforeEach(async () => {
        const mockCustomerRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
        };

        const mockInternalRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
        };

        const mockDoctorRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
        };

        const mockRoleRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        const mockJwtService = {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
            verifyAsync: jest.fn().mockResolvedValue({ email: 'test@test.com' }),
        };

        const mockConfigService = {
            get: jest.fn().mockReturnValue('test-secret'),
        };

        const mockDataSource = {};

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(Customer),
                    useValue: mockCustomerRepository,
                },
                {
                    provide: getRepositoryToken(Internal),
                    useValue: mockInternalRepository,
                },
                {
                    provide: getRepositoryToken(Doctor),
                    useValue: mockDoctorRepository,
                },
                {
                    provide: getRepositoryToken(Role),
                    useValue: mockRoleRepository,
                },
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        customerRepository = module.get(getRepositoryToken(Customer));
        internalRepository = module.get(getRepositoryToken(Internal));
        doctorRepository = module.get(getRepositoryToken(Doctor));
        roleRepository = module.get(getRepositoryToken(Role));
        jwtService = module.get<JwtService>(JwtService);
        configService = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('checkDuplicateEmailWithRole', () => {
        it('should return Customer role when email exists in customer table', async () => {
            customerRepository.findOne.mockResolvedValue(mockCustomer);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            const result = await service.checkDuplicateEmailWithRole('customer@test.com');

            expect(result).toBe(RoleEnum.Customer);
            expect(customerRepository.findOne).toHaveBeenCalledWith({
                where: { email: 'customer@test.com' },
            });
        });

        it('should return Doctor role when email exists in doctor table', async () => {
            customerRepository.findOne.mockResolvedValue(null);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(mockDoctor);

            const result = await service.checkDuplicateEmailWithRole('doctor@test.com');

            expect(result).toBe(RoleEnum.Doctor);
        });

        it('should return Admin role when email exists in internal table with admin role', async () => {
            customerRepository.findOne.mockResolvedValue(null);
            internalRepository.findOne.mockResolvedValue(mockInternal);
            doctorRepository.findOne.mockResolvedValue(null);

            const result = await service.checkDuplicateEmailWithRole('admin@test.com');

            expect(result).toBe(RoleEnum.Admin);
        });

        it('should return null when email does not exist in any table', async () => {
            customerRepository.findOne.mockResolvedValue(null);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            const result = await service.checkDuplicateEmailWithRole('nonexistent@test.com');

            expect(result).toBeNull();
        });
    });

    describe('generateToken', () => {
        it('should generate access and refresh tokens for customer', async () => {
            const payload = {
                id: 'customer-1',
                email: 'customer@test.com',
                role: RoleEnum.Customer,
            };

            (jwtService.signAsync as jest.Mock)
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            customerRepository.update.mockResolvedValue({});

            const result = await service.generateToken(payload);

            expect(result).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
            expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
            expect(customerRepository.update).toHaveBeenCalledWith(
                { email: 'customer@test.com' },
                { refreshToken: 'refresh-token' },
            );
        });

        it('should generate tokens for admin user', async () => {
            const payload = {
                id: 'internal-1',
                email: 'admin@test.com',
                role: RoleEnum.Admin,
            };

            (jwtService.signAsync as jest.Mock)
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            internalRepository.update.mockResolvedValue({});

            const result = await service.generateToken(payload);

            expect(result).toEqual({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
            expect(internalRepository.update).toHaveBeenCalledWith(
                { email: 'admin@test.com' },
                { refreshToken: 'refresh-token' },
            );
        });
    });

    describe('refreshToken', () => {
        it('should refresh token for customer', async () => {
            const refreshToken = 'valid-refresh-token';
            const payload = { email: 'customer@test.com' };

            (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);
            customerRepository.findOne.mockResolvedValue(mockCustomer);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            (jwtService.signAsync as jest.Mock)
                .mockResolvedValueOnce('new-access-token')
                .mockResolvedValueOnce('new-refresh-token');

            customerRepository.update.mockResolvedValue({});

            const result = await service.refreshToken(refreshToken);

            expect(result).toEqual({
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            });
        });

        it('should throw error for invalid refresh token', async () => {
            const refreshToken = 'invalid-refresh-token';

            (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('Invalid token'));

            await expect(service.refreshToken(refreshToken)).rejects.toThrow();
        });
    });

    describe('registerCustomer', () => {
        it('should register a new customer successfully', async () => {
            const customerData = {
                email: 'newcustomer@test.com',
                full_name: 'New Customer',
                password: 'password123',
                phone: '0123456789',
            };

            customerRepository.findOne.mockResolvedValue(null);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            customerRepository.create.mockReturnValue(customerData);
            customerRepository.save.mockResolvedValue({
                ...customerData,
                id: 'new-customer-id',
                password: 'hashedPassword',
            });

            const result = await service.registerCustomer(customerData);

            expect(result).toEqual({
                ...customerData,
                id: 'new-customer-id',
                password: 'hashedPassword',
            });
            expect(customerRepository.create).toHaveBeenCalledWith(customerData);
            expect(customerRepository.save).toHaveBeenCalled();
        });

        it('should throw error when email already exists', async () => {
            const customerData = {
                email: 'existing@test.com',
                full_name: 'Existing Customer',
                password: 'password123',
                phone: '0123456789',
            };

            customerRepository.findOne.mockResolvedValue(mockCustomer);

            await expect(service.registerCustomer(customerData)).rejects.toThrow();
        });

        it('should throw error when email is not provided', async () => {
            const customerData = {
                full_name: 'Customer Without Email',
                password: 'password123',
                phone: '0123456789',
            };

            await expect(service.registerCustomer(customerData)).rejects.toThrow();
        });
    });

    describe('login', () => {
        it('should login customer successfully', async () => {
            const loginDto: LoginDto = {
                email: 'customer@test.com',
                password: 'password123',
            };

            customerRepository.findOne.mockResolvedValue(mockCustomer);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            // Mock bcrypt.compare
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

            (jwtService.signAsync as jest.Mock)
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            customerRepository.update.mockResolvedValue({});

            const result = await service.login(loginDto);

            expect(result).toEqual({
                id: 'customer-1',
                email: 'customer@test.com',
                name: 'Test Customer',
                role: RoleEnum.Customer,
                spaId: null,
                address: null,
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });
        });

        it('should login admin successfully', async () => {
            const loginDto: LoginDto = {
                email: 'admin@test.com',
                password: 'password123',
            };

            customerRepository.findOne.mockResolvedValue(null);
            internalRepository.findOne.mockResolvedValue(mockInternal);
            doctorRepository.findOne.mockResolvedValue(null);

            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

            (jwtService.signAsync as jest.Mock)
                .mockResolvedValueOnce('access-token')
                .mockResolvedValueOnce('refresh-token');

            internalRepository.update.mockResolvedValue({});

            const result = await service.login(loginDto);

            expect(result.role).toBe(RoleEnum.Admin);
        });

        it('should throw error for invalid credentials', async () => {
            const loginDto: LoginDto = {
                email: 'nonexistent@test.com',
                password: 'wrongpassword',
            };

            customerRepository.findOne.mockResolvedValue(null);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            await expect(service.login(loginDto)).rejects.toThrow();
        });

        it('should throw error for inactive account', async () => {
            const loginDto: LoginDto = {
                email: 'customer@test.com',
                password: 'password123',
            };

            const inactiveCustomer = { ...mockCustomer, isActive: false };
            customerRepository.findOne.mockResolvedValue(inactiveCustomer);
            internalRepository.findOne.mockResolvedValue(null);
            doctorRepository.findOne.mockResolvedValue(null);

            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

            await expect(service.login(loginDto)).rejects.toThrow();
        });
    });
});
