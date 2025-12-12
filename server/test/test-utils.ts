import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * Tạo mock repository cho testing
 */
export function createMockRepository() {
    return {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneBy: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        softDelete: jest.fn(),
        softRemove: jest.fn(),
        count: jest.fn(),
        query: jest.fn(),
    };
}

/**
 * Tạo mock JWT service
 */
export function createMockJwtService() {
    return {
        signAsync: jest.fn(),
        verifyAsync: jest.fn(),
        sign: jest.fn(),
        verify: jest.fn(),
    };
}

/**
 * Tạo mock Config service
 */
export function createMockConfigService() {
    return {
        get: jest.fn().mockReturnValue('test-value'),
    };
}

/**
 * Tạo mock DataSource
 */
export function createMockDataSource() {
    return {
        getRepository: jest.fn(),
        createQueryBuilder: jest.fn(),
        transaction: jest.fn(),
    };
}

/**
 * Tạo mock Cloudinary
 */
export function createMockCloudinary() {
    return {
        uploader: {
            upload_stream: jest.fn(),
            upload: jest.fn(),
            destroy: jest.fn(),
        },
    };
}

/**
 * Mock bcrypt functions
 */ 
export function mockBcrypt() {
    jest.mock('bcrypt', () => ({
        compare: jest.fn(),
        hash: jest.fn(),
        genSalt: jest.fn(),
    }));
}

/**
 * Tạo test module với các dependencies cơ bản
 */
export async function createTestModule(
    providers: any[],
    repositories: { entity: any; mockRepo: any }[] = [],
) {
    const moduleBuilder = Test.createTestingModule({
        providers,
    });

    // Thêm mock repositories
    repositories.forEach(({ entity, mockRepo }) => {
        moduleBuilder
            .overrideProvider(getRepositoryToken(entity))
            .useValue(mockRepo);
    });

    return await moduleBuilder.compile();
}

/**
 * Tạo mock user data
 */
export const mockUsers = {
    customer: {
        id: 'customer-1',
        email: 'customer@test.com',
        full_name: 'Test Customer',
        password: 'hashedPassword',
        phone: '0123456789',
        isActive: true,
        isDeleted: false,
    },
    admin: {
        id: 'admin-1',
        email: 'admin@test.com',
        full_name: 'Test Admin',
        password: 'hashedPassword',
        isActive: true,
        role: { id: 1, name: 'admin', description: 'System administrator' },
    },
    doctor: {
        id: 'doctor-1',
        email: 'doctor@test.com',
        full_name: 'Test Doctor',
        password: 'hashedPassword',
        specialization: 'Dermatology',
        isActive: true,
    },
};

/**
 * Tạo mock service data
 */
export const mockServices = {
    service: {
        id: 'service-1',
        name: 'Deep Cleansing Facial',
        price: 150000,
        description: 'Deep cleansing facial treatment',
        images: [
            { url: 'https://cloudinary.com/image1.jpg', alt: 'Service image 1' },
        ],
        categoryId: 'category-1',
        isActive: true,
    },
    category: {
        id: 'category-1',
        name: 'Facial Treatment',
        description: 'Facial treatments and skincare',
        isActive: true,
    },
};

/**
 * Tạo mock appointment data
 */
export const mockAppointments = {
    appointment: {
        id: 'appointment-1',
        customerId: 'customer-1',
        doctorId: 'doctor-1',
        appointment_date: new Date(),
        status: 'pending',
        startTime: new Date(),
        endTime: new Date(),
    },
};

/**
 * Helper để tạo mock files cho testing
 */
export function createMockFiles(count: number = 1): Express.Multer.File[] {
    return Array.from({ length: count }, (_, index) => ({
        fieldname: 'images',
        originalname: `test${index + 1}.jpg`,
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: Buffer.from(`test image ${index + 1}`),
        size: 1024 * (index + 1),
    })) as Express.Multer.File[];
}

/**
 * Helper để tạo mock DTOs
 */
export const mockDtos = {
    createCustomer: {
        full_name: 'New Customer',
        email: 'newcustomer@test.com',
        password: 'password123',
        phone: '0123456789',
        gender: 'male',
    },
    createService: {
        name: 'New Service',
        price: 200000,
        description: 'New service description',
        categoryId: 'category-1',
        isActive: true,
    },
    login: {
        email: 'customer@test.com',
        password: 'password123',
    },
};
