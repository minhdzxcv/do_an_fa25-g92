import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { Voucher } from '@/entities/voucher.entity';
import { CustomerVoucher } from '@/entities/customerVoucher.entity';
import { Customer } from '@/entities/customer.entity';
import { Spa } from '@/entities/spa.entity';
import { MailService } from '../mail/mail.service';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';
import { IsNull } from 'typeorm';

describe('VoucherService', () => {
  let service: VoucherService;
  let voucherRepository: any;
  let customerVoucherRepository: any;
  let customerRepository: any;
  let spaRepository: any;
  let mailService: MailService;

  const mockVoucher = {
    id: 'voucher-1',
    code: 'TEST123',
    description: 'Test voucher',
    discountAmount: 10000,
    discountPercent: null,
    maxDiscount: null,
    validFrom: new Date(),
    validTo: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCustomer = {
    id: 'customer-1',
    email: 'customer@test.com',
    full_name: 'Test Customer',
  };

  const mockSpa = {
    id: 'spa-1',
    name: 'GenSpa',
    phone: '1900 1234',
    address: '123 Test St',
  };

  beforeEach(async () => {
    const mockVoucherRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockCustomerVoucherRepository = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const mockCustomerRepository = {
      findOne: jest.fn(),
    };

    const mockSpaRepository = {
      findOne: jest.fn(),
    };

    const mockMailService = {
      sendVoucherEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherService,
        {
          provide: getRepositoryToken(Voucher),
          useValue: mockVoucherRepository,
        },
        {
          provide: getRepositoryToken(CustomerVoucher),
          useValue: mockCustomerVoucherRepository,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(Spa),
          useValue: mockSpaRepository,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<VoucherService>(VoucherService);
    voucherRepository = module.get(getRepositoryToken(Voucher));
    customerVoucherRepository = module.get(getRepositoryToken(CustomerVoucher));
    customerRepository = module.get(getRepositoryToken(Customer));
    spaRepository = module.get(getRepositoryToken(Spa));
    mailService = module.get<MailService>(MailService);

    // Mock loadSpa
    spaRepository.findOne.mockResolvedValue(mockSpa);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createForCustomers', () => {
    it('should create a new voucher successfully without customers', async () => {
      const createDto: CreateVoucherDto = {
        code: 'NEW123',
        description: 'New voucher',
        discountAmount: 5000,
      };

      voucherRepository.findOne.mockResolvedValue(null);
      voucherRepository.create.mockReturnValue(mockVoucher);
      voucherRepository.save.mockResolvedValue(mockVoucher);

      const result = await service.createForCustomers(createDto);

      expect(result).toEqual(mockVoucher);
      expect(voucherRepository.findOne).toHaveBeenCalled();
      const callArgs = voucherRepository.findOne.mock.calls[0][0];
      expect(callArgs.where.code).toBe(createDto.code);
      expect(voucherRepository.create).toHaveBeenCalledWith(createDto);
      expect(voucherRepository.save).toHaveBeenCalled();
      expect(mailService.sendVoucherEmail).not.toHaveBeenCalled();
    });

    it('should create voucher and send emails to customers', async () => {
      const createDto: CreateVoucherDto = {
        code: 'NEW123',
        description: 'New voucher',
        discountAmount: 5000,
        customerIds: ['customer-1', 'customer-2'],
      };

      voucherRepository.findOne.mockResolvedValue(null);
      voucherRepository.create.mockReturnValue(mockVoucher);
      voucherRepository.save.mockResolvedValue(mockVoucher);
      customerRepository.findOne.mockResolvedValue(mockCustomer);
      customerVoucherRepository.save.mockResolvedValue({});

      const result = await service.createForCustomers(createDto);

      expect(result).toEqual(mockVoucher);
      expect(customerRepository.findOne).toHaveBeenCalledTimes(2);
      expect(customerVoucherRepository.save).toHaveBeenCalledTimes(2);
      expect(mailService.sendVoucherEmail).toHaveBeenCalledTimes(2);
    });

    it('should skip customer if not found', async () => {
      const createDto: CreateVoucherDto = {
        code: 'NEW123',
        description: 'New voucher',
        discountAmount: 5000,
        customerIds: ['nonexistent-customer'],
      };

      voucherRepository.findOne.mockResolvedValue(null);
      voucherRepository.create.mockReturnValue(mockVoucher);
      voucherRepository.save.mockResolvedValue(mockVoucher);
      customerRepository.findOne.mockResolvedValue(null);

      const result = await service.createForCustomers(createDto);

      expect(result).toEqual(mockVoucher);
      expect(customerVoucherRepository.save).not.toHaveBeenCalled();
      expect(mailService.sendVoucherEmail).not.toHaveBeenCalled();
    });

    it('should throw error when voucher code already exists', async () => {
      const createDto: CreateVoucherDto = {
        code: 'EXISTING123',
        description: 'Existing voucher',
        discountAmount: 5000,
      };

      voucherRepository.findOne.mockResolvedValue(mockVoucher);

      await expect(service.createForCustomers(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createForCustomers(createDto)).rejects.toThrow(
        'Mã voucher đã tồn tại',
      );
    });
  });

  describe('findAll', () => {
    it('should return all vouchers', async () => {
      const vouchers = [mockVoucher];
      voucherRepository.find.mockResolvedValue(vouchers);

      const result = await service.findAll();

      expect(result).toEqual(vouchers);
      expect(voucherRepository.find).toHaveBeenCalled();
      const callArgs = voucherRepository.find.mock.calls[0][0];
      expect(callArgs.order.createdAt).toBe('DESC');
    });
  });

  describe('findOne', () => {
    it('should return a voucher by id with customer ids', async () => {
      const mockCustomerVouchers = [
        { customerId: 'customer-1', voucherId: 'voucher-1' },
        { customerId: 'customer-2', voucherId: 'voucher-1' },
      ];

      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.find.mockResolvedValue(mockCustomerVouchers);

      const result = await service.findOne('voucher-1');

      expect(result).toEqual({
        ...mockVoucher,
        customerIds: ['customer-1', 'customer-2'],
      });
      expect(voucherRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
      });
      expect(customerVoucherRepository.find).toHaveBeenCalledWith({
        where: { voucherId: 'voucher-1' },
      });
    });

    it('should return voucher with empty customer ids', async () => {
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.find.mockResolvedValue([]);

      const result = await service.findOne('voucher-1');

      expect(result).toEqual({
        ...mockVoucher,
        customerIds: [],
      });
    });

    it('should throw NotFoundException when voucher not found', async () => {
      voucherRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        'Voucher not found',
      );
    });
  });

  describe('update', () => {
    it('should update voucher successfully without customer changes', async () => {
      const updateDto: UpdateVoucherDto = {
        description: 'Updated description',
      };

      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.find.mockResolvedValue([]);
      voucherRepository.save.mockResolvedValue({
        ...mockVoucher,
        ...updateDto,
      });

      const result = await service.update('voucher-1', updateDto);

      expect(result).toEqual({ ...mockVoucher, ...updateDto, customerIds: [] });
      expect(voucherRepository.save).toHaveBeenCalled();
    });

    it('should update voucher and add new customers', async () => {
      const updateDto = {
        description: 'Updated description',
        customerIds: ['customer-1', 'customer-2'],
      };

      const oldCustomerVouchers = [
        { customerId: 'customer-1', voucherId: 'voucher-1' },
      ];

      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(oldCustomerVouchers);
      voucherRepository.save.mockResolvedValue({ ...mockVoucher, ...updateDto });
      customerRepository.findOne.mockResolvedValue(mockCustomer);
      customerVoucherRepository.create.mockImplementation((data) => data);
      customerVoucherRepository.save.mockResolvedValue([]);
      customerVoucherRepository.delete.mockResolvedValue({});

      const result = await service.update('voucher-1', updateDto);

      expect(customerVoucherRepository.delete).toHaveBeenCalledWith({ voucherId: 'voucher-1' });
      expect(customerVoucherRepository.save).toHaveBeenCalled();
      expect(mailService.sendVoucherEmail).toHaveBeenCalledTimes(1);
    });

    it('should not send emails if no new customers', async () => {
      const updateDto = {
        description: 'Updated',
        customerIds: ['customer-1'],
      };

      const oldCustomerVouchers = [
        { customerId: 'customer-1', voucherId: 'voucher-1' },
      ];

      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(oldCustomerVouchers);
      voucherRepository.save.mockResolvedValue(mockVoucher);
      customerVoucherRepository.create.mockImplementation((data) => data);
      customerVoucherRepository.save.mockResolvedValue([]);
      customerVoucherRepository.delete.mockResolvedValue({});

      await service.update('voucher-1', updateDto);

      expect(mailService.sendVoucherEmail).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete voucher successfully', async () => {
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      customerVoucherRepository.find.mockResolvedValue([]);
      voucherRepository.softRemove.mockResolvedValue(mockVoucher);

      await service.remove('voucher-1');

      expect(voucherRepository.softRemove).toHaveBeenCalled();
    });

    it('should throw NotFoundException when voucher not found', async () => {
      voucherRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findVouchersByCustomer', () => {
    it('should return vouchers for a customer', async () => {
      const mockCustomerVouchers = [
        { customerId: 'customer-1', voucherId: 'voucher-1', isUsed: false, createdAt: new Date() },
        { customerId: 'customer-1', voucherId: 'voucher-2', isUsed: false, createdAt: new Date() },
      ];

      const mockVouchers = [
        { ...mockVoucher, id: 'voucher-1' },
        { ...mockVoucher, id: 'voucher-2' },
      ];

      customerVoucherRepository.find.mockResolvedValue(mockCustomerVouchers);
      voucherRepository.find.mockResolvedValue(mockVouchers);

      const result = await service.findVouchersByCustomer('customer-1');

      expect(result).toEqual(mockVouchers);
      expect(customerVoucherRepository.find).toHaveBeenCalledWith({
        where: { customerId: 'customer-1', isUsed: false },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array when customer has no vouchers', async () => {
      customerVoucherRepository.find.mockResolvedValue([]);

      const result = await service.findVouchersByCustomer('customer-1');

      expect(result).toEqual([]);
      expect(voucherRepository.find).not.toHaveBeenCalled();
    });

    it('should only return unused vouchers', async () => {
      const mockCustomerVouchers = [
        { customerId: 'customer-1', voucherId: 'voucher-1', isUsed: false, createdAt: new Date() },
      ];

      customerVoucherRepository.find.mockResolvedValue(mockCustomerVouchers);
      voucherRepository.find.mockResolvedValue([mockVoucher]);

      await service.findVouchersByCustomer('customer-1');

      const callArgs = customerVoucherRepository.find.mock.calls[0][0];
      expect(callArgs.where.isUsed).toBe(false);
    });
  });
});
