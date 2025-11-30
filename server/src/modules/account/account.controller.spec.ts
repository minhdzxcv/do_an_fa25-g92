import { Test, TestingModule } from '@nestjs/testing';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

describe('AccountController', () => {
    let  controller: AccountController;


    
    beforeEach(async () => {
        const mockAccountService = {
            createCustomer: jest.fn(),
            findAllCustomers: jest.fn(),
            findOneCustomer: jest.fn(),
            updateCustomer: jest.fn(),
            removeCustomer: jest.fn(),
            toggleCustomerActive: jest.fn(),
            updateCustomerPassword: jest.fn(),
            createInternal: jest.fn(),
            findAllInternals: jest.fn(),
            findOneInternal: jest.fn(),
            updateInternal: jest.fn(),
            removeInternal: jest.fn(),
            findAllInternalRoles: jest.fn(),
            toggleInternalActive: jest.fn(),
            updateInternalPassword: jest.fn(),
            createDoctor: jest.fn(),
            findAllDoctors: jest.fn(),
            findOneDoctor: jest.fn(),
            updateDoctor: jest.fn(),
            removeDoctor: jest.fn(),
            toggleDoctorActive: jest.fn(),
            updateDoctorPassword: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AccountController],
            providers: [
                {
                    provide: AccountService,
                    useValue: mockAccountService,
                },
            ],
        }).compile();

        controller = module.get<AccountController>(AccountController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });
});
