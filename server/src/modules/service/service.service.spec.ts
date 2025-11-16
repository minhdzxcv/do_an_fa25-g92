import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { ServiceService } from './service.service';
import { Service } from '@/entities/service.entity';
import { Category } from '@/entities/category.entity';
import { Doctor } from '@/entities/doctor.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

// Mock cloudinary
jest.mock('@/utils/cloudinary', () => ({
    cloudinary: {
        uploader: {
            upload_stream: jest.fn(),
        },
    },
}));

describe('ServiceService', () => {
    let service: ServiceService;
    let serviceRepository: any;
    let categoryRepository: any;
    let doctorRepository: any;

    const mockCategory = {
        id: 'category-1',
        name: 'Facial Treatment',
        description: 'Facial treatments and skincare',
        isActive: true,
    };

    const mockService = {
        id: 'service-1',
        name: 'Deep Cleansing Facial',
        price: 150000,
        description: 'Deep cleansing facial treatment',
        images: [
            { url: 'https://cloudinary.com/image1.jpg', alt: 'Service image 1' },
            { url: 'https://cloudinary.com/image2.jpg', alt: 'Service image 2' },
        ],
        category: mockCategory,
        categoryId: 'category-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockFiles = [
        {
            fieldname: 'images',
            originalname: 'test1.jpg',
            encoding: '7bit',
            mimetype: 'image/jpeg',
            buffer: Buffer.from('test image 1'),
            size: 1024,
        },
        {
            fieldname: 'images',
            originalname: 'test2.jpg',
            encoding: '7bit',
            mimetype: 'image/jpeg',
            buffer: Buffer.from('test image 2'),
            size: 2048,
        },
    ] as Express.Multer.File[];

    beforeEach(async () => {
        const mockServiceRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            softRemove: jest.fn(),
        };

        const mockCategoryRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        const mockDoctorRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            findByIds: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ServiceService,
                {
                    provide: getRepositoryToken(Service),
                    useValue: mockServiceRepository,
                },
                {
                    provide: getRepositoryToken(Category),
                    useValue: mockCategoryRepository,
                },
                {
                    provide: getRepositoryToken(Doctor),
                    useValue: mockDoctorRepository,
                },
            ],
        }).compile();

        service = module.get<ServiceService>(ServiceService);
        serviceRepository = module.get(getRepositoryToken(Service));
        categoryRepository = module.get(getRepositoryToken(Category));
        doctorRepository = module.get(getRepositoryToken(Doctor));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createService', () => {
        it('should create a service with images successfully', async () => {
            const createServiceDto: CreateServiceDto = {
                name: 'New Service',
                price: 200000,
                description: 'New service description',
                categoryId: 'category-1',
                isActive: true,
            };

            // Mock cloudinary upload
            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(null, { secure_url: 'https://cloudinary.com/new-image.jpg' });
                return { end: jest.fn() };
            });

            serviceRepository.create.mockReturnValue(createServiceDto);
            serviceRepository.save.mockResolvedValue({
                ...createServiceDto,
                id: 'new-service-id',
                images: [
                    { url: 'https://cloudinary.com/new-image.jpg' },
                    { url: 'https://cloudinary.com/new-image.jpg' },
                ],
            });

            const result = await service.createService(createServiceDto, mockFiles);

            expect(result).toHaveProperty('id', 'new-service-id');
            expect((result as any).images).toHaveLength(2);
            expect(serviceRepository.save).toHaveBeenCalled();
        });

        it('should create a service without images successfully', async () => {
            const createServiceDto: CreateServiceDto = {
                name: 'New Service',
                price: 200000,
                description: 'New service description',
                categoryId: 'category-1',
                isActive: true,
            };

            serviceRepository.create.mockReturnValue(createServiceDto);
            serviceRepository.save.mockResolvedValue({
                ...createServiceDto,
                id: 'new-service-id',
                images: [],
            });

            const result = await service.createService(createServiceDto, []);

            expect(result).toEqual({
                ...createServiceDto,
                id: 'new-service-id',
                images: [],
            });
            expect(serviceRepository.create).toHaveBeenCalledWith({
                ...createServiceDto,
                images: [],
            });
        });
    });

    describe('findAllServices', () => {
        it('should return all active services', async () => {
            const services = [mockService];
            serviceRepository.find.mockResolvedValue(services);

            const result = await service.findAllServices();

            expect(result).toEqual(services);
            expect(serviceRepository.find).toHaveBeenCalled();
            const callArg = serviceRepository.find.mock.calls[0][0];
            expect(callArg).toHaveProperty('relations');
            expect(callArg.relations).toContain('category');
        });

        it('should return empty array when no services found', async () => {
            serviceRepository.find.mockResolvedValue([]);

            const result = await service.findAllServices();

            expect(result).toEqual([]);
        });
    });

    describe('findOneService', () => {
        it('should return a service by id', async () => {
            serviceRepository.findOne.mockResolvedValue(mockService);

            const result = await service.findOneService('service-1');

            expect(result).toEqual(mockService);
            expect(serviceRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'service-1' },
                relations: ['category'],
            });
        });

        it('should throw NotFoundException when service not found', async () => {
            serviceRepository.findOne.mockResolvedValue(null);

            await expect(service.findOneService('nonexistent-id')).rejects.toThrow(
                NotFoundException,
            );
            await expect(service.findOneService('nonexistent-id')).rejects.toThrow(
                'Không tìm thấy dịch vụ',
            );
        });
    });

    describe('updateService', () => {
        it('should update service successfully without files', async () => {
            const updateDto: UpdateServiceDto = {
                name: 'Updated Service',
                price: 250000,
                description: 'Updated description',
                categoryId: 'category-1',
                isActive: true,
                id: 'service-1',
            };

            serviceRepository.findOne.mockResolvedValue(mockService);
            serviceRepository.save.mockResolvedValue({
                ...mockService,
                ...updateDto,
            });

            const result = await service.updateService('service-1', updateDto);

            expect(result).toEqual({
                ...mockService,
                ...updateDto,
            });
            expect(serviceRepository.save).toHaveBeenCalled();
        });

        it('should update service with new images', async () => {
            const updateDto: UpdateServiceDto = {
                name: 'Updated Service',
                price: 250000,
                description: 'Updated description',
                categoryId: 'category-1',
                isActive: true,
                id: 'service-1',
            };

            // Mock cloudinary upload
            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(null, { secure_url: 'https://cloudinary.com/updated-image.jpg' });
                return { end: jest.fn() };
            });

            serviceRepository.findOne.mockResolvedValue(mockService);
            serviceRepository.save.mockResolvedValue({
                ...mockService,
                ...updateDto,
                images: [
                    ...mockService.images,
                    { url: 'https://cloudinary.com/updated-image.jpg' },
                ],
            });

            const result = await service.updateService('service-1', updateDto, mockFiles);

            expect(result.images).toHaveLength(3); // 2 existing + 1 new
            expect(serviceRepository.save).toHaveBeenCalled();
        });

        it('should update service and delete specified images', async () => {
            const updateDto: UpdateServiceDto = {
                name: 'Updated Service',
                price: 250000,
                description: 'Updated description',
                categoryId: 'category-1',
                isActive: true,
                id: 'service-1',
            };

            const deletedImages = ['https://cloudinary.com/image1.jpg'];

            serviceRepository.findOne.mockResolvedValue(mockService);
            serviceRepository.save.mockResolvedValue({
                ...mockService,
                ...updateDto,
                images: [{ url: 'https://cloudinary.com/image2.jpg', alt: 'Service image 2' }],
            });

            const result = await service.updateService(
                'service-1',
                updateDto,
                [],
                deletedImages,
            );

            expect(result.images).toHaveLength(1);
            expect(result.images[0].url).toBe('https://cloudinary.com/image2.jpg');
        });

        it('should handle string isActive value', async () => {
            const updateDto: UpdateServiceDto = {
                name: 'Updated Service',
                price: 250000,
                description: 'Updated description',
                categoryId: 'category-1',
                isActive: 'true' as any,
                id: 'service-1',
            };

            serviceRepository.findOne.mockResolvedValue(mockService);
            serviceRepository.save.mockResolvedValue({
                ...mockService,
                ...updateDto,
                isActive: true,
            });

            const result = await service.updateService('service-1', updateDto);

            expect(result.isActive).toBe(true);
        });

        it('should throw error when service not found', async () => {
            serviceRepository.findOne.mockResolvedValue(null);

            const updateDto: any = {
                id: 'nonexistent-id',
                name: 'Test',
                price: 100,
                categoryId: 'cat-1',
                isActive: true,
            };

            await expect(service.updateService('nonexistent-id', updateDto)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('deleteService', () => {
        it('should soft delete service successfully', async () => {
            serviceRepository.findOne.mockResolvedValue(mockService);
            serviceRepository.softRemove.mockResolvedValue(mockService);

            const result = await service.deleteService('service-1');

            expect(result).toEqual(mockService);
            expect(serviceRepository.softRemove).toHaveBeenCalledWith(mockService);
        });

        it('should throw error when service not found', async () => {
            serviceRepository.findOne.mockResolvedValue(null);

            await expect(service.deleteService('nonexistent-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('uploadImagesToCloudinary', () => {
        it('should upload images to cloudinary successfully', async () => {
            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(null, { secure_url: 'https://cloudinary.com/test-image.jpg' });
                return { end: jest.fn() };
            });

            const result = await service.uploadImagesToCloudinary(mockFiles);

            expect(result).toEqual([
                { url: 'https://cloudinary.com/test-image.jpg' },
                { url: 'https://cloudinary.com/test-image.jpg' },
            ]);
            expect(mockUploadStream).toHaveBeenCalledTimes(2);
        });

        it('should handle cloudinary upload error', async () => {
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

        it('should handle cloudinary upload with no result', async () => {
            const { cloudinary } = require('@/utils/cloudinary');
            const mockUploadStream = jest.fn();
            cloudinary.uploader.upload_stream = mockUploadStream;

            mockUploadStream.mockImplementation((options, callback) => {
                callback(null, null);
                return { end: jest.fn() };
            });

            await expect(service.uploadImagesToCloudinary(mockFiles)).rejects.toThrow(
                'Lỗi khi tải lên hình ảnh',
            );
        });
    });

    describe('findPublicServices', () => {
        it('should return all active public services', async () => {
            const services = [mockService];
            serviceRepository.find.mockResolvedValue(services);

            const mockQueryBuilder = {
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            };
            doctorRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.findPublicServices();

            expect(Array.isArray(result)).toBe(true);
            expect(serviceRepository.find).toHaveBeenCalled();
        });

        it('should return empty array when no active services found', async () => {
            serviceRepository.find.mockResolvedValue([]);

            const result = await service.findPublicServices();

            expect(result).toEqual([]);
        });
    });

    describe('findOnePublicService', () => {
        it('should return a public service by id', async () => {
            serviceRepository.findOne.mockResolvedValue(mockService);

            const mockQueryBuilder = {
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            };
            doctorRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.findOnePublicService('service-1');

            expect(result).toHaveProperty('id', 'service-1');
            expect(serviceRepository.findOne).toHaveBeenCalled();
        });

        it('should throw NotFoundException when service not found', async () => {
            serviceRepository.findOne.mockResolvedValue(null);

            await expect(service.findOnePublicService('nonexistent-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('findDoctorsByService', () => {
        it('should return doctors for a service', async () => {
            const mockDoctors = [
                {
                    id: 'doctor-1',
                    full_name: 'Doctor 1',
                    isActive: true,
                },
            ];

            serviceRepository.findOne.mockResolvedValue(mockService);

            const mockQueryBuilder = {
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockDoctors),
            };
            doctorRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await service.findDoctorsByService('service-1');

            expect(result).toEqual(mockDoctors);
            expect(doctorRepository.createQueryBuilder).toHaveBeenCalled();
        });

        it('should throw NotFoundException when no doctors found', async () => {
            serviceRepository.findOne.mockResolvedValue(mockService);

            const mockQueryBuilder = {
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            };
            doctorRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            await expect(service.findDoctorsByService('service-1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('findServicesByDoctor', () => {
        it('should return services for a doctor', async () => {
            const mockDoctor = {
                id: 'doctor-1',
                full_name: 'Doctor 1',
                services: [mockService],
            };

            doctorRepository.findOne.mockResolvedValue(mockDoctor);

            const result = await service.findServicesByDoctor('doctor-1');

            expect(result).toEqual([mockService]);
            expect(doctorRepository.findOne).toHaveBeenCalled();
        });

        it('should throw NotFoundException when doctor not found', async () => {
            doctorRepository.findOne.mockResolvedValue(null);

            await expect(service.findServicesByDoctor('nonexistent-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException when doctor has no services', async () => {
            const mockDoctor = {
                id: 'doctor-1',
                services: [],
            };

            doctorRepository.findOne.mockResolvedValue(mockDoctor);

            await expect(service.findServicesByDoctor('doctor-1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});