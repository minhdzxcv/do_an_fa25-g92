import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { Membership } from '@/entities/membership.entity';
import { UpdateMembershipDto } from './dto/membership.dto';

describe('MembershipService', () => {
  let service: MembershipService;
  let membershipRepository: any;

  const mockMembership = {
    id: 'membership-1',
    name: 'Regular',
    minSpent: 0,
    maxSpent: 9999999,
    discountPercent: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockMembershipRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipService,
        {
          provide: getRepositoryToken(Membership),
          useValue: mockMembershipRepository,
        },
      ],
    }).compile();

    service = module.get<MembershipService>(MembershipService);
    membershipRepository = module.get(getRepositoryToken(Membership));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all memberships ordered by minSpent', async () => {
      const memberships = [
        mockMembership,
        {
          ...mockMembership,
          id: 'membership-2',
          name: 'VIP',
          minSpent: 50000000,
        },
      ];

      membershipRepository.find.mockResolvedValue(memberships);

      const result = await service.findAll();

      expect(result).toEqual(memberships);
      expect(membershipRepository.find).toHaveBeenCalledWith({
        order: { minSpent: 'ASC' },
      });
    });

    it('should return empty array when no memberships exist', async () => {
      membershipRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(membershipRepository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a membership by id', async () => {
      membershipRepository.findOne.mockResolvedValue(mockMembership);

      const result = await service.findOne('membership-1');

      expect(result).toEqual(mockMembership);
      expect(membershipRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'membership-1' },
      });
    });

    it('should throw NotFoundException when membership not found', async () => {
      membershipRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        'Không tìm thấy Membership có id: nonexistent-id',
      );
    });
  });

  describe('update', () => {
    it('should update membership successfully', async () => {
      const updateDto: UpdateMembershipDto = {
        discountPercent: 5,
      };

      membershipRepository.findOne.mockResolvedValue(mockMembership);
      membershipRepository.save.mockResolvedValue({
        ...mockMembership,
        ...updateDto,
      });

      const result = await service.update('membership-1', updateDto);

      expect(result).toEqual({
        ...mockMembership,
        ...updateDto,
      });
      expect(membershipRepository.save).toHaveBeenCalled();
    });

    it('should update multiple fields', async () => {
      const updateDto: UpdateMembershipDto = {
        name: 'Premium',
        discountPercent: 10,
        minSpent: 10000000,
        maxSpent: 49999999,
      };

      membershipRepository.findOne.mockResolvedValue(mockMembership);
      membershipRepository.save.mockResolvedValue({
        ...mockMembership,
        ...updateDto,
      });

      const result = await service.update('membership-1', updateDto);

      expect(result.name).toBe('Premium');
      expect(result.discountPercent).toBe(10);
      expect(result.minSpent).toBe(10000000);
      expect(result.maxSpent).toBe(49999999);
    });

    it('should throw NotFoundException when membership not found', async () => {
      const updateDto: UpdateMembershipDto = {
        discountPercent: 5,
      };

      membershipRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCustomer', () => {
    it('should return membership for a customer', async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockMembership),
      };

      membershipRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findByCustomer('customer-1');

      expect(result).toEqual(mockMembership);
      expect(membershipRepository.createQueryBuilder).toHaveBeenCalledWith('membership');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'membership.customers',
        'customer',
        'customer.id = :customerId',
        { customerId: 'customer-1' },
      );
      expect(mockQueryBuilder.getOne).toHaveBeenCalled();
    });

    it('should return null when customer has no membership', async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      membershipRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findByCustomer('customer-1');

      expect(result).toBeNull();
    });

    it('should return null when customer not found', async () => {
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(undefined),
      };

      membershipRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findByCustomer('nonexistent-customer');

      expect(result).toBeNull();
    });
  });
});
