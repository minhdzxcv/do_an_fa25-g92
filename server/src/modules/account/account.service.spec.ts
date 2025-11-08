import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AccountService } from './account.service';
import { Customer } from '@/entities/customer.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Role } from '@/entities/role.entity';
import { Service } from '@/entities/service.entity';
import { CreateCustomerDto } from './dto/customer.dto';
import { CreateInternalDto } from './dto/internal.dto';
import { CreateDoctorDto } from './dto/doctor.dto';
import { RoleEnum } from '@/common/types/role.enum';
import { Gender } from '@/entities/customer.entity';

describe('AccountService', () => {
    let service: AccountService;
    let customerRepository: any;
    let internalRepository: any;
    let doctorRepository: any;
    let roleRepository: any;
    let serviceRepository: any;
    let jwtService: JwtService;

    const mockCustomer = {
        id: 'customer-1',
        email: 'customer@test.com',
        full_name: 'Test Customer',
        password: 'hashedPassword',
        phone: '0123456789',
        isActive: true,
        isDeleted: false,
    };

    const mockInternal = {
        id: 'internal-1',
        email: 'admin@test.com',
        full_name: 'Test Admin',
        password: 'hashedPassword',
        isActive: true,
        role: { id: 1, name: 'admin', description: 'System administrator' },
    };

    const mockDoctor = {
        id: 'doctor-1',
        email: 'doctor@test.com',
        full_name: 'Test Doctor',
        password: 'hashedPassword',
        specialization: 'Dermatology',
        isActive: true,
        services: [],
    };

    const mockRole = {
        id: 1,
        name: 'admin',
        description: 'System administrator',
    };

    beforeEach(async () => {
        const mockCustomerRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            remove: jest.fn(),
        };

        const mockInternalRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([mockInternal]),
            })),
        };

        const mockDoctorRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            softRemove: jest.fn(),
        };

        const mockRoleRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        const mockServiceRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            findByIds: jest.fn().mockResolvedValue([]),
        };

        const mockJwtService = {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
        };

        const mockDataSource = {};

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountService,
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
                    provide: getRepositoryToken(Service),
                    useValue: mockServiceRepository,
                },
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        service = module.get<AccountService>(AccountService);
        customerRepository = module.get(getRepositoryToken(Customer));
        internalRepository = module.get(getRepositoryToken(Internal));
        doctorRepository = module.get(getRepositoryToken(Doctor));
        roleRepository = module.get(getRepositoryToken(Role));
        serviceRepository = module.get(getRepositoryToken(Service));
        jwtService = module.get<JwtService>(JwtService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Customer Management', () => {
        describe('createCustomer', () => {
            it('should create a new customer successfully', async () => {
                const createCustomerDto: CreateCustomerDto = {
                    full_name: 'New Customer',
                    email: 'newcustomer@test.com',
                    password: 'password123',
                    phone: '0123456789',
                    gender: Gender.Male,
                };

                customerRepository.findOne.mockResolvedValue(null);
                customerRepository.create.mockReturnValue(createCustomerDto);
                customerRepository.save.mockResolvedValue({
                    ...createCustomerDto,
                    id: 'new-customer-id',
                    password: 'hashedPassword',
                });

                const result = await service.createCustomer(createCustomerDto);

                expect(result).toEqual({
                    ...createCustomerDto,
                    id: 'new-customer-id',
                    password: 'hashedPassword',
                });
                expect(customerRepository.create).toHaveBeenCalledWith(createCustomerDto);
                expect(customerRepository.save).toHaveBeenCalled();
            });

            it('should throw error when email already exists', async () => {
                const createCustomerDto: CreateCustomerDto = {
                    full_name: 'New Customer',
                    email: 'existing@test.com',
                    password: 'password123',
                    phone: '0123456789',
                    gender: Gender.Male,
                };

                customerRepository.findOne.mockResolvedValue(mockCustomer);

                await expect(service.createCustomer(createCustomerDto)).rejects.toThrow();
            });
        });

        describe('findAllCustomers', () => {
            it('should return all customers', async () => {
                const customers = [mockCustomer];
                customerRepository.find.mockResolvedValue(customers);

                const result = await service.findAllCustomers();

                expect(result).toHaveLength(1);
                expect(result[0]).not.toHaveProperty('password');
                expect(customerRepository.find).toHaveBeenCalled();
            });
        });

        describe('findOneCustomer', () => {
            it('should return a customer by id', async () => {
                customerRepository.findOne.mockResolvedValue(mockCustomer);

                const result = await service.findOneCustomer('customer-1');

                expect(result).toEqual(mockCustomer);
                expect(customerRepository.findOne).toHaveBeenCalledWith({
                    where: { id: 'customer-1' },
                });
            });

            it('should throw error when customer not found', async () => {
                customerRepository.findOne.mockResolvedValue(null);

                await expect(service.findOneCustomer('nonexistent-id')).rejects.toThrow();
            });
        });

        describe('updateCustomer', () => {
            it('should update customer successfully', async () => {
                const updateDto: any = {
                    full_name: 'Updated Customer',
                    email: 'updated@test.com',
                    phone: '0987654321',
                    gender: Gender.Male,
                };

                customerRepository.findOne.mockResolvedValue(mockCustomer);
                customerRepository.save.mockResolvedValue({
                    ...mockCustomer,
                    ...updateDto,
                });

                const result = await service.updateCustomer('customer-1', updateDto);

                expect(result).toHaveProperty('name');
                expect(result).toHaveProperty('role');
                expect(result).not.toHaveProperty('password');
                expect(customerRepository.save).toHaveBeenCalled();
            });

            it('should throw error when customer not found', async () => {
                customerRepository.findOne.mockResolvedValue(null);

                const updateDto: any = {
                    full_name: 'Test',
                    email: 'test@test.com',
                    phone: '123',
                    gender: Gender.Male,
                };

                await expect(service.updateCustomer('nonexistent-id', updateDto)).rejects.toThrow();
            });
        });

        describe('removeCustomer', () => {
            it('should soft delete customer successfully', async () => {
                customerRepository.findOne.mockResolvedValue(mockCustomer);
                customerRepository.remove.mockResolvedValue({});

                await service.removeCustomer('customer-1');

                expect(customerRepository.remove).toHaveBeenCalledWith(mockCustomer);
            });

            it('should throw error when customer not found', async () => {
                customerRepository.findOne.mockResolvedValue(null);

                await expect(service.removeCustomer('nonexistent-id')).rejects.toThrow();
            });
        });

        describe('toggleCustomerActive', () => {
            it('should toggle customer active status', async () => {
                customerRepository.findOne.mockResolvedValue(mockCustomer);
                customerRepository.save.mockResolvedValue({
                    ...mockCustomer,
                    isActive: false,
                });

                const result = await service.toggleCustomerActive('customer-1');

                expect(result.isActive).toBe(false);
                expect(customerRepository.save).toHaveBeenCalled();
            });
        });

        describe('updateCustomerPassword', () => {
            it('should update customer password successfully', async () => {
                const updatePasswordDto = {
                    id: 'customer-1',
                    newPassword: 'newPassword',
                };

                customerRepository.findOne.mockResolvedValue(mockCustomer);
                customerRepository.save.mockResolvedValue({
                    ...mockCustomer,
                    password: 'newHashedPassword',
                });

                const result = await service.updateCustomerPassword(updatePasswordDto);

                expect(result).toEqual({
                    ...mockCustomer,
                    password: 'newHashedPassword',
                });
                expect(customerRepository.save).toHaveBeenCalled();
            });

            it('should throw error when customer not found', async () => {
                const updatePasswordDto = {
                    id: 'nonexistent-id',
                    newPassword: 'newPassword',
                };

                customerRepository.findOne.mockResolvedValue(null);

                await expect(service.updateCustomerPassword(updatePasswordDto)).rejects.toThrow();
            });
        });
    });

    describe('Internal Management', () => {
        describe('createInternal', () => {
            it('should create a new internal user successfully', async () => {
                const createInternalDto: any = {
                    full_name: 'New Staff',
                    email: 'newstaff@test.com',
                    password: 'password123',
                    phone: '0123456789',
                    gender: Gender.Male,
                    positionID: 'staff-role-id',
                };

                const staffRole = { id: 2, name: 'staff', description: 'Staff member' };

                internalRepository.findOne.mockResolvedValue(null);
                roleRepository.findOne.mockResolvedValue(staffRole);
                internalRepository.create.mockReturnValue(createInternalDto);
                internalRepository.save.mockResolvedValue({
                    ...createInternalDto,
                    id: 'new-internal-id',
                    password: 'hashedPassword',
                    role: staffRole,
                });

                const result = await service.createInternal(createInternalDto);

                expect(result).toEqual({
                    ...createInternalDto,
                    id: 'new-internal-id',
                    password: 'hashedPassword',
                    role: staffRole,
                });
                expect(internalRepository.create).toHaveBeenCalled();
                expect(internalRepository.save).toHaveBeenCalled();
            });

            it('should throw error when email already exists', async () => {
                const createInternalDto: any = {
                    full_name: 'New Admin',
                    email: 'existing@test.com',
                    password: 'password123',
                    phone: '0123456789',
                    gender: Gender.Male,
                    positionID: 'admin',
                };

                internalRepository.findOne.mockResolvedValue(mockInternal);

                await expect(service.createInternal(createInternalDto)).rejects.toThrow();
            });
        });

        describe('findAllInternals', () => {
            it('should return all internal users', async () => {
                const internals = [mockInternal];

                const result = await service.findAllInternals();

                expect(result).toEqual(internals);
                expect(internalRepository.createQueryBuilder).toHaveBeenCalledWith('internal');
            });
        });

        describe('findAllInternalRoles', () => {
            it('should return all roles', async () => {
                const roles = [mockRole];
                roleRepository.find.mockResolvedValue(roles);

                const result = await service.findAllInternalRoles();

                expect(result).toEqual(roles);
                expect(roleRepository.find).toHaveBeenCalled();
            });
        });
    });

    describe('Doctor Management', () => {
        describe('createDoctor', () => {
            it('should create a new doctor successfully', async () => {
                const createDoctorDto: any = {
                    full_name: 'New Doctor',
                    email: 'newdoctor@test.com',
                    password: 'password123',
                    phone: '0123456789',
                    gender: Gender.Male,
                    specialization: 'Dermatology',
                    biography: 'Experienced dermatologist',
                    experience_years: '5',
                    serviceIds: [],
                };

                doctorRepository.findOne.mockResolvedValue(null);
                doctorRepository.create.mockReturnValue({
                    ...createDoctorDto,
                    experience_years: 5,
                });
                doctorRepository.save.mockResolvedValue({
                    ...createDoctorDto,
                    id: 'new-doctor-id',
                    password: 'hashedPassword',
                    experience_years: 5,
                });

                const result = await service.createDoctor(createDoctorDto);

                expect(result).toHaveProperty('id', 'new-doctor-id');
                expect(result).toHaveProperty('experience_years', 5);
                expect(doctorRepository.save).toHaveBeenCalled();
            });

            it('should throw error when email already exists', async () => {
                const createDoctorDto: any = {
                    full_name: 'New Doctor',
                    email: 'existing@test.com',
                    password: 'password123',
                    phone: '0123456789',
                    gender: Gender.Male,
                    specialization: 'Dermatology',
                    biography: 'Test',
                    experience_years: '5',
                    serviceIds: [],
                };

                doctorRepository.findOne.mockResolvedValue(mockDoctor);

                await expect(service.createDoctor(createDoctorDto)).rejects.toThrow();
            });
        });

        describe('findAllDoctors', () => {
            it('should return all doctors', async () => {
                const doctors = [mockDoctor];
                doctorRepository.find.mockResolvedValue(doctors);

                const result = await service.findAllDoctors();

                expect(result).toHaveLength(1);
                expect(result[0]).not.toHaveProperty('password');
                expect(doctorRepository.find).toHaveBeenCalled();
            });
        });

        describe('findOneDoctor', () => {
            it('should return a doctor by id', async () => {
                doctorRepository.findOne.mockResolvedValue(mockDoctor);

                const result = await service.findOneDoctor('doctor-1');

                expect(result).toHaveProperty('id', 'doctor-1');
                expect(result).not.toHaveProperty('password');
                expect(result).toHaveProperty('services');
                expect(doctorRepository.findOne).toHaveBeenCalledWith({
                    where: { id: 'doctor-1' },
                    relations: ['services'],
                });
            });

            it('should throw error when doctor not found', async () => {
                doctorRepository.findOne.mockResolvedValue(null);

                await expect(service.findOneDoctor('nonexistent-id')).rejects.toThrow();
            });
        });

        describe('updateDoctor', () => {
            it('should update doctor successfully', async () => {
                const updateDto: any = {
                    full_name: 'Updated Doctor',
                    email: 'updated@test.com',
                    gender: Gender.Male,
                    specialization: 'Updated Specialization',
                    biography: 'Updated bio',
                    experience_years: '10',
                    serviceIds: [],
                };

                doctorRepository.findOne.mockResolvedValue(mockDoctor);
                serviceRepository.findByIds.mockResolvedValue([]);
                doctorRepository.save.mockResolvedValue({
                    ...mockDoctor,
                    ...updateDto,
                });

                const result = await service.updateDoctor('doctor-1', updateDto);

                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('services');
                expect(doctorRepository.save).toHaveBeenCalled();
            });

            it('should throw error when doctor not found', async () => {
                doctorRepository.findOne.mockResolvedValue(null);

                const updateDto: any = {
                    full_name: 'Test',
                    email: 'test@test.com',
                    gender: Gender.Male,
                    specialization: 'Test',
                    biography: 'Test',
                    experience_years: '5',
                    serviceIds: [],
                };

                await expect(service.updateDoctor('nonexistent-id', updateDto)).rejects.toThrow();
            });
        });

        describe('removeDoctor', () => {
            it('should soft delete doctor successfully', async () => {
                const doctorWithServices = { ...mockDoctor, services: [] };
                doctorRepository.findOne.mockResolvedValueOnce(doctorWithServices);
                doctorRepository.softRemove.mockResolvedValue({});

                await service.removeDoctor('doctor-1');

                expect(doctorRepository.softRemove).toHaveBeenCalled();
                const callArg = doctorRepository.softRemove.mock.calls[0][0];
                expect(callArg).toHaveProperty('id', 'doctor-1');
                expect(callArg).not.toHaveProperty('password');
            });

            it('should throw error when doctor not found', async () => {
                doctorRepository.findOne.mockResolvedValue(null);

                await expect(service.removeDoctor('nonexistent-id')).rejects.toThrow();
            });
        });

        describe('toggleDoctorActive', () => {
            it('should toggle doctor active status', async () => {
                const doctorWithServices = { ...mockDoctor, services: [] };
                doctorRepository.findOne
                    .mockResolvedValueOnce(doctorWithServices)
                    .mockResolvedValueOnce({ ...doctorWithServices, isActive: false });
                doctorRepository.save.mockResolvedValue({
                    ...doctorWithServices,
                    isActive: false,
                });

                const result = await service.toggleDoctorActive('doctor-1');

                expect(result.isActive).toBe(false);
                expect(doctorRepository.save).toHaveBeenCalled();
            });
        });

        describe('updateDoctorPassword', () => {
            it('should update doctor password successfully', async () => {
                const updatePasswordDto = {
                    id: 'doctor-1',
                    newPassword: 'newPassword',
                };

                const doctorWithServices = { ...mockDoctor, services: [] };
                doctorRepository.findOne.mockResolvedValue(doctorWithServices);
                doctorRepository.save.mockResolvedValue({
                    ...doctorWithServices,
                    password: 'newHashedPassword',
                });

                const result = await service.updateDoctorPassword(updatePasswordDto);

                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('password');
                expect(doctorRepository.save).toHaveBeenCalled();
            });

            it('should throw error when doctor not found', async () => {
                const updatePasswordDto = {
                    id: 'nonexistent-id',
                    newPassword: 'newPassword',
                };

                doctorRepository.findOne.mockResolvedValue(null);

                await expect(service.updateDoctorPassword(updatePasswordDto)).rejects.toThrow();
            });
        });
    });
});