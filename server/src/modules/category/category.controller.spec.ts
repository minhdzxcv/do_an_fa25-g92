import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { CreateCategoryServiceDto, UpdateCategoryServiceDto } from './dto/category.dto';
import { NotFoundException } from '@nestjs/common';

describe('CategoryController', () => {
    let controller: CategoryController;
    let service: CategoryService;

    const mockCategoryService = {
        findAll: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    const mockCategory = {
        id: '1',
        name: 'Category A',
        description: 'Sample category',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CategoryController],
            providers: [
                {
                    provide: CategoryService,
                    useValue: mockCategoryService,
                },
            ],
        }).compile();

        controller = module.get<CategoryController>(CategoryController);
        service = module.get<CategoryService>(CategoryService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return an array of categories', async () => {
            const mockCategories = [mockCategory];
            mockCategoryService.findAll.mockResolvedValue(mockCategories);

            const result = await controller.findAll();

            expect(service.findAll).toHaveBeenCalled();
            expect(result).toEqual(mockCategories);
        });

        it('should return empty array when no categories exist', async () => {
            mockCategoryService.findAll.mockResolvedValue([]);

            const result = await controller.findAll();

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });
    });

    describe('findOne', () => {
        it('should return a category by id', async () => {
            const id = '1';
            mockCategoryService.findOne.mockResolvedValue(mockCategory);

            const result = await controller.findOne(id);

            expect(service.findOne).toHaveBeenCalledWith(id);
            expect(result).toEqual(mockCategory);
        });

        it('should throw NotFoundException when category not found', async () => {
            const id = '999';
            mockCategoryService.findOne.mockRejectedValue(
                new NotFoundException('Không tìm thấy danh mục'),
            );

            await expect(controller.findOne(id)).rejects.toThrow(NotFoundException);
            expect(service.findOne).toHaveBeenCalledWith(id);
        });
    });

    describe('create', () => {
        it('should create a new category', async () => {
            const dto: CreateCategoryServiceDto = {
                name: 'New Category',
                description: 'New Description',
                isActive: true,
            };
            const createdCategory = { ...mockCategory, ...dto };

            mockCategoryService.create.mockResolvedValue(createdCategory);

            const result = await controller.create(dto);

            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(createdCategory);
        });

        it('should create category with minimal fields', async () => {
            const dto: CreateCategoryServiceDto = {
                name: 'Minimal Category',
            };
            const createdCategory = { 
                ...mockCategory, 
                name: 'Minimal Category',
                description: undefined,
            };

            mockCategoryService.create.mockResolvedValue(createdCategory);

            const result = await controller.create(dto);

            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(createdCategory);
        });
    });

    describe('update', () => {
        it('should update an existing category', async () => {
            const id = '1';
            const dto: UpdateCategoryServiceDto = {
                name: 'Updated Category',
                description: 'Updated Description',
            };
            const updatedCategory = { ...mockCategory, ...dto };

            mockCategoryService.update.mockResolvedValue(updatedCategory);

            const result = await controller.update(id, dto);

            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result).toEqual(updatedCategory);
        });

        it('should update only name field', async () => {
            const id = '1';
            const dto: UpdateCategoryServiceDto = {
                name: 'Only Name Updated',
            };
            const updatedCategory = { ...mockCategory, name: 'Only Name Updated' };

            mockCategoryService.update.mockResolvedValue(updatedCategory);

            const result = await controller.update(id, dto);

            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result).toEqual(updatedCategory);
        });

        it('should update isActive status', async () => {
            const id = '1';
            const dto: UpdateCategoryServiceDto = {
                isActive: false,
            };
            const updatedCategory = { ...mockCategory, isActive: false };

            mockCategoryService.update.mockResolvedValue(updatedCategory);

            const result = await controller.update(id, dto);

            expect(service.update).toHaveBeenCalledWith(id, dto);
            expect(result.isActive).toBe(false);
        });

        it('should throw NotFoundException when updating non-existent category', async () => {
            const id = '999';
            const dto: UpdateCategoryServiceDto = { name: 'Updated' };

            mockCategoryService.update.mockRejectedValue(
                new NotFoundException('Không tìm thấy danh mục'),
            );

            await expect(controller.update(id, dto)).rejects.toThrow(NotFoundException);
        });
    });

    describe('remove', () => {
        it('should soft delete a category successfully', async () => {
            const id = '1';
            mockCategoryService.remove.mockResolvedValue(true);

            const result = await controller.remove(id);

            expect(service.remove).toHaveBeenCalledWith(id);
            expect(result).toBe(true);
        });

        it('should throw NotFoundException when deleting non-existent category', async () => {
            const id = '999';
            mockCategoryService.remove.mockRejectedValue(
                new NotFoundException('Không tìm thấy danh mục'),
            );

            await expect(controller.remove(id)).rejects.toThrow(NotFoundException);
            expect(service.remove).toHaveBeenCalledWith(id);
        });

        it('should return false when delete affects 0 rows', async () => {
            const id = '1';
            mockCategoryService.remove.mockResolvedValue(false);

            const result = await controller.remove(id);

            expect(result).toBe(false);
        });
    });
});
