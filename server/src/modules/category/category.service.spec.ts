import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { CategoryService } from './category.service';
import { Category } from '@/entities/category.entity';

describe('CategoryService', () => {
  let service: CategoryService;
  let categoryRepository: any;

  beforeEach(async () => {
    const mockCategoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    categoryRepository = module.get(getRepositoryToken(Category));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ✅ Mock dữ liệu đầy đủ, phù hợp với entity
  const mockCategory: Category = {
    id: '1',
    name: 'Category A',
    description: 'Sample category',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined, // ✅ Sửa từ null → undefined
  };

  describe('findAll', () => {
    it('should return all categories that are not deleted', async () => {
      const mockCategories = [mockCategory];
      categoryRepository.find.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(categoryRepository.find).toHaveBeenCalledWith({
        where: { deletedAt: IsNull() },
      });
      expect(result).toEqual(mockCategories);
    });
  });

  describe('findOne', () => {
    it('should return one category if found', async () => {
      categoryRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne('1');

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1', deletedAt: IsNull() },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException if category not found', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return new category', async () => {
      const dto = { name: 'New Category', description: 'New Desc' };
      const mockEntity = { ...mockCategory, ...dto };

      categoryRepository.create.mockReturnValue(dto);
      categoryRepository.save.mockResolvedValue(mockEntity);

      const result = await service.create(dto as any);

      expect(categoryRepository.create).toHaveBeenCalledWith(dto);
      expect(categoryRepository.save).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockEntity);
    });
  });

  describe('update', () => {
    it('should update existing category and return updated result', async () => {
      const id = '1';
      const dto = { name: 'Updated Category', description: 'Updated Desc' };
      const updatedCategory = { ...mockCategory, ...dto };

      jest.spyOn(service, 'findOne').mockResolvedValueOnce(mockCategory);
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(updatedCategory);
      categoryRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(id, dto as any);

      expect(categoryRepository.update).toHaveBeenCalledWith(id, dto);
      expect(result).toEqual(updatedCategory);
    });

    it('should throw NotFoundException if category not found for update', async () => {
      const id = '999';
      const dto = { name: 'Updated' };

      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException());

      await expect(service.update(id, dto as any)).rejects.toThrow(NotFoundException);
    });

    it('should update only provided fields', async () => {
      const id = '1';
      const dto = { name: 'Only Name Updated' };
      const updatedCategory = { ...mockCategory, name: 'Only Name Updated' };

      jest.spyOn(service, 'findOne').mockResolvedValueOnce(mockCategory);
      jest.spyOn(service, 'findOne').mockResolvedValueOnce(updatedCategory);
      categoryRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(id, dto as any);

      expect(categoryRepository.update).toHaveBeenCalledWith(id, dto);
      expect(result).toEqual(updatedCategory);
    });
  });

  describe('remove', () => {
    it('should soft delete category and return true', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);
      categoryRepository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('1');

      expect(service.findOne).toHaveBeenCalledWith('1');
      expect(categoryRepository.softDelete).toHaveBeenCalledWith('1');
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if category not found before delete', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new NotFoundException());

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });

    it('should return false if softDelete affects 0 rows', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);
      categoryRepository.softDelete.mockResolvedValue({ affected: 0 });

      const result = await service.remove('1');

      expect(result).toBe(false);
    });

    it('should return false if softDelete affected is null', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);
      categoryRepository.softDelete.mockResolvedValue({ affected: null });

      const result = await service.remove('1');

      expect(result).toBe(false);
    });

    it('should return false if softDelete affected is undefined', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockCategory);
      categoryRepository.softDelete.mockResolvedValue({ affected: undefined });

      const result = await service.remove('1');

      expect(result).toBe(false);
    });
  });
});
