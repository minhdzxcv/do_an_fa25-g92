import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { Voucher } from '@/entities/voucher.entity';
import { CreateVoucherDto, UpdateVoucherDto } from './dto/voucher.dto';

describe('VoucherService', () => {
  let service: VoucherService;
  let voucherRepository: any;

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

  beforeEach(async () => {
    const mockVoucherRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      softRemove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherService,
        {
          provide: getRepositoryToken(Voucher),
          useValue: mockVoucherRepository,
        },
      ],
    }).compile();

    service = module.get<VoucherService>(VoucherService);
    voucherRepository = module.get(getRepositoryToken(Voucher));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new voucher successfully', async () => {
      const createDto: CreateVoucherDto = {
        code: 'NEW123',
        description: 'New voucher',
        discountAmount: 5000,
      };

      voucherRepository.findOne.mockResolvedValue(null);
      voucherRepository.create.mockReturnValue(mockVoucher);
      voucherRepository.save.mockResolvedValue(mockVoucher);

      const result = await service.create(createDto);

      expect(result).toEqual(mockVoucher);
      expect(voucherRepository.findOne).toHaveBeenCalled();
      const callArgs = voucherRepository.findOne.mock.calls[0][0];
      expect(callArgs.where.code).toBe(createDto.code);
      expect(voucherRepository.create).toHaveBeenCalledWith(createDto);
      expect(voucherRepository.save).toHaveBeenCalled();
    });

    it('should throw error when voucher code already exists', async () => {
      const createDto: CreateVoucherDto = {
        code: 'EXISTING123',
        description: 'Existing voucher',
        discountAmount: 5000,
      };

      voucherRepository.findOne.mockResolvedValue(mockVoucher);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
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
    it('should return a voucher by id', async () => {
      voucherRepository.findOne.mockResolvedValue(mockVoucher);

      const result = await service.findOne('voucher-1');

      expect(result).toEqual(mockVoucher);
      expect(voucherRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'voucher-1' },
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
    it('should update voucher successfully', async () => {
      const updateDto: UpdateVoucherDto = {
        description: 'Updated description',
      };

      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      voucherRepository.save.mockResolvedValue({
        ...mockVoucher,
        ...updateDto,
      });

      const result = await service.update('voucher-1', updateDto);

      expect(result).toEqual({ ...mockVoucher, ...updateDto });
      expect(voucherRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete voucher successfully', async () => {
      voucherRepository.findOne.mockResolvedValue(mockVoucher);
      voucherRepository.softRemove.mockResolvedValue(mockVoucher);

      await service.remove('voucher-1');

      expect(voucherRepository.softRemove).toHaveBeenCalledWith(mockVoucher);
    });
  });
});
