import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
    let controller: CategoryController;

    beforeEach(async () => {
        const mockCategoryService = {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };

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
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
