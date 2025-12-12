import { Test, TestingModule } from '@nestjs/testing';
import { ServiceController } from './service.controller';
import { ServiceService } from './service.service';

describe('ServiceController', () => {
    let controller: ServiceController;

    beforeEach(async () => {
        const mockServiceService = {
            createService: jest.fn(),
            findAllServices: jest.fn(),
            findOneService: jest.fn(),
            updateService: jest.fn(),
            deleteService: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ServiceController],
            providers: [
                {
                    provide: ServiceService,
                    useValue: mockServiceService,
                },
            ],
        }).compile();

        controller = module.get<ServiceController>(ServiceController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
