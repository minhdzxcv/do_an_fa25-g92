import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { Customer } from '@/entities/customer.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Role } from '@/entities/role.entity';
import { RoleEnum } from '@/common/types/role.enum';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { UpdateCustomerProfileDto, ChangePasswordDto } from './dto/customer.dto';

// Mock cloudinary
jest.mock('@/utils/cloudinary', () => ({
    cloudinary: {
        uploader: {
            upload_stream: jest.fn(),
        },
    },
}));

describe('AuthService', () => {
    let service: AuthService;
    let customerRepository: any;
    let internalRepository: any;
    let doctorRepository: any;
    let roleRepository: any;
    let jwtService: JwtService;
    let configService: ConfigService;
    let mailService: MailService;

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

        const mockMailService = {
            sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
            confirmAppointment: jest.fn().mockResolvedValue(undefined),
            confirmAppointmentDeposit: jest.fn().mockResolvedValue(undefined),
            sendThankYouForUsingServiceEmail: jest.fn().mockResolvedValue(undefined),
        };

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
                {
                    provide: MailService,
                    useValue: mockMailService,
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
        mailService = module.get<MailService>(MailService);
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

    describe('findCustomerProfile', () => {
        it('should return customer profile without password and refreshToken', async () => {
            const customerWithRelations = {
                ...mockCustomer,
                membership: { id: 'membership-1', name: 'Regular' },
                cart: { id: 'cart-1' },
            };

            customerRepository.findOne.mockResolvedValue(customerWithRelations);

            const result = await service.findCustomerProfile('customer-1');

            expect(result).not.toHaveProperty('password');
            expect(result).not.toHaveProperty('refreshToken');
            expect(result).toHaveProperty('id', 'customer-1');
            expect(customerRepository.findOne).toHaveBeenCalled();
            const callArgs = customerRepository.findOne.mock.calls[0][0];
            expect(callArgs.where.id).toBe('customer-1');
            expect(callArgs.relations).toEqual(['membership', 'cart']);
        });

        it('should throw NotFoundException when customer not found', async () => {
            customerRepository.findOne.mockResolvedValue(null);

            await expect(service.findCustomerProfile('nonexistent-id')).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.findCustomerProfile('nonexistent-id')).rejects.toThrow(
                'Không tìm thấy khách hàng',
            );
        });
    });

    describe('updateCustomerProfile', () => {
        it('should update customer profile successfully', async () => {
            const updateDto: UpdateCustomerProfileDto = {
                full_name: 'Updated Name',
                phone: '0987654321',
            };

            customerRepository.findOne.mockResolvedValue(mockCustomer);
            customerRepository.save.mockResolvedValue({
                ...mockCustomer,
                ...updateDto,
            });

            const result = await service.updateCustomerProfile('customer-1', updateDto);

            expect(result).not.toHaveProperty('password');
            expect(result).not.toHaveProperty('refreshToken');
            expect(customerRepository.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when customer not found', async () => {
            const updateDto: UpdateCustomerProfileDto = {
                full_name: 'Updated Name',
            };

            customerRepository.findOne.mockResolvedValue(null);

            await expect(
                service.updateCustomerProfile('nonexistent-id', updateDto),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateCustomerAvatar', () => {
        it('should update customer avatar successfully', async () => {
            const mockFile = {
                fieldname: 'file',
                originalname: 'avatar.jpg',
                encoding: '7bit',
                mimetype: 'image/jpeg',
                buffer: Buffer.from('test image'),
                size: 1024,
            } as Express.Multer.File;

            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(null, { secure_url: 'https://cloudinary.com/avatar.jpg' });
                return { end: jest.fn() };
            });

            customerRepository.findOne.mockResolvedValue(mockCustomer);
            customerRepository.save.mockResolvedValue({
                ...mockCustomer,
                avatar: 'https://cloudinary.com/avatar.jpg',
            });

            const result = await service.updateCustomerAvatar('customer-1', mockFile);

            expect(result).toHaveProperty('avatar', 'https://cloudinary.com/avatar.jpg');
            expect(result).not.toHaveProperty('password');
            expect(customerRepository.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when customer not found', async () => {
            const mockFile = {
                buffer: Buffer.from('test'),
            } as Express.Multer.File;

            customerRepository.findOne.mockResolvedValue(null);

            await expect(
                service.updateCustomerAvatar('nonexistent-id', mockFile),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('uploadImagesToCloudinary', () => {
        it('should upload images to cloudinary successfully', async () => {
            const mockFiles = [
                {
                    buffer: Buffer.from('test image 1'),
                },
                {
                    buffer: Buffer.from('test image 2'),
                },
            ] as Express.Multer.File[];

            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(null, { secure_url: 'https://cloudinary.com/image.jpg' });
                return { end: jest.fn() };
            });

            const result = await service.uploadImagesToCloudinary(mockFiles);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('url', 'https://cloudinary.com/image.jpg');
            expect(mockUploadStream).toHaveBeenCalledTimes(2);
        });

        it('should handle cloudinary upload error', async () => {
            const mockFiles = [
                {
                    buffer: Buffer.from('test image'),
                },
            ] as Express.Multer.File[];

            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(new Error('Upload failed'), null);
                return { end: jest.fn() };
            });

            await expect(service.uploadImagesToCloudinary(mockFiles)).rejects.toThrow(
                'Lỗi khi tải lên hình ảnh',
            );
        });
    });

    describe('changePassword', () => {
        it('should change password successfully', async () => {
            const changePasswordDto: ChangePasswordDto = {
                oldPassword: 'oldPassword123',
                newPassword: 'newPassword123',
            };

            customerRepository.findOne.mockResolvedValue(mockCustomer);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
            customerRepository.save.mockResolvedValue({
                ...mockCustomer,
                password: 'newHashedPassword',
            });

            const result = await service.changePassword('customer-1', changePasswordDto);

            expect(result).toEqual({ message: 'Đổi mật khẩu thành công' });
            expect(customerRepository.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when user not found', async () => {
            const changePasswordDto: ChangePasswordDto = {
                oldPassword: 'oldPassword123',
                newPassword: 'newPassword123',
            };

            customerRepository.findOne.mockResolvedValue(null);

            await expect(
                service.changePassword('nonexistent-id', changePasswordDto),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when old password is incorrect', async () => {
            const changePasswordDto: ChangePasswordDto = {
                oldPassword: 'wrongPassword',
                newPassword: 'newPassword123',
            };

            customerRepository.findOne.mockResolvedValue(mockCustomer);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

            await expect(
                service.changePassword('customer-1', changePasswordDto),
            ).rejects.toThrow(BadRequestException);
            await expect(
                service.changePassword('customer-1', changePasswordDto),
            ).rejects.toThrow('Mật khẩu cũ không chính xác');
        });
    });

    describe('forgotPassword', () => {
        it('should send reset password email successfully', async () => {
            const email = 'customer@test.com';

            customerRepository.findOne.mockResolvedValue(mockCustomer);
            (jwtService.signAsync as jest.Mock).mockResolvedValue('reset-token');
            customerRepository.save.mockResolvedValue({
                ...mockCustomer,
                resetToken: 'reset-token',
            });
            (mailService.sendResetPasswordEmail as jest.Mock).mockResolvedValue(undefined);

            const result = await service.forgotPassword(email);

            expect(result).toEqual({
                message: 'Đã gửi link đặt lại mật khẩu đến email của bạn.',
            });
            expect(jwtService.signAsync).toHaveBeenCalled();
            expect(mailService.sendResetPasswordEmail).toHaveBeenCalled();
            expect(customerRepository.save).toHaveBeenCalled();
        });

        it('should throw NotFoundException when email does not exist', async () => {
            const email = 'nonexistent@test.com';

            customerRepository.findOne.mockResolvedValue(null);

            await expect(service.forgotPassword(email)).rejects.toThrow(NotFoundException);
            await expect(service.forgotPassword(email)).rejects.toThrow(
                'Email không tồn tại trong hệ thống',
            );
        });
    });

    describe('resetPassword', () => {
        it('should reset password successfully', async () => {
            const token = 'valid-reset-token';
            const newPassword = 'newPassword123';
            const decoded = { email: 'customer@test.com' };

            const userWithToken = {
                ...mockCustomer,
                resetToken: token,
                resetTokenExpire: new Date(Date.now() + 15 * 60 * 1000),
            };

            (jwtService.verifyAsync as jest.Mock).mockResolvedValue(decoded);
            customerRepository.findOne.mockResolvedValue(userWithToken);
            customerRepository.save.mockResolvedValue({
                ...userWithToken,
                password: 'newHashedPassword',
                resetToken: null,
                resetTokenExpire: null,
            });

            const result = await service.resetPassword(token, newPassword);

            expect(result).toEqual({ message: 'Đặt lại mật khẩu thành công' });
            expect(customerRepository.save).toHaveBeenCalled();
        });

        it('should throw BadRequestException when token is invalid', async () => {
            const token = 'invalid-token';
            const newPassword = 'newPassword123';

            (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('Invalid token'));

            await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException when token does not match', async () => {
            const token = 'wrong-token';
            const newPassword = 'newPassword123';
            const decoded = { email: 'customer@test.com' };

            const userWithDifferentToken = {
                ...mockCustomer,
                resetToken: 'different-token',
                resetTokenExpire: new Date(Date.now() + 15 * 60 * 1000),
            };

            (jwtService.verifyAsync as jest.Mock).mockResolvedValue(decoded);
            customerRepository.findOne.mockResolvedValue(userWithDifferentToken);

            await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw BadRequestException when token is expired', async () => {
            const token = 'expired-token';
            const newPassword = 'newPassword123';
            const decoded = { email: 'customer@test.com' };

            const userWithExpiredToken = {
                ...mockCustomer,
                resetToken: token,
                resetTokenExpire: new Date(Date.now() - 1000), // Expired
            };

            (jwtService.verifyAsync as jest.Mock).mockResolvedValue(decoded);
            customerRepository.findOne.mockResolvedValue(userWithExpiredToken);

            await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
                BadRequestException,
            );
        });
    });
});
