import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';
import { Cart } from '@/entities/cart.entity';
import { CartDetail } from '@/entities/cartDetails.entity';
import { Service } from '@/entities/service.entity';
import { Category } from '@/entities/category.entity';
import { Doctor } from '@/entities/doctor.entity';

describe('CartService', () => {
  let service: CartService;
  let cartRepository: any;
  let cartDetailRepository: any;
  let serviceRepository: any;
  let categoryRepository: any;
  let doctorRepository: any;

  beforeEach(async () => {
    const mockCartRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockCartDetailRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    const mockServiceRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockCategoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockDoctorRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: getRepositoryToken(Cart),
          useValue: mockCartRepository,
        },
        {
          provide: getRepositoryToken(CartDetail),
          useValue: mockCartDetailRepository,
        },
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

    service = module.get<CartService>(CartService);
    cartRepository = module.get(getRepositoryToken(Cart));
    cartDetailRepository = module.get(getRepositoryToken(CartDetail));
    serviceRepository = module.get(getRepositoryToken(Service));
    categoryRepository = module.get(getRepositoryToken(Category));
    doctorRepository = module.get(getRepositoryToken(Doctor));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCartById', () => {
    it('should return existing cart', async () => {
      const customerId = 'customer-1';
      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);

      const result = await service.getCartById(customerId);

      expect(result).toBeDefined();
      expect(cartRepository.findOne).toHaveBeenCalledWith({
        where: { customerId },
        relations: ['details', 'details.service'],
      });
    });

    it('should create new cart if not exists', async () => {
      const customerId = 'customer-1';
      const newCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      cartRepository.findOne.mockResolvedValue(null);
      cartRepository.create.mockReturnValue(newCart);
      cartRepository.save.mockResolvedValue(newCart);

      const result = await service.getCartById(customerId);

      expect(result).toBeDefined();
      expect(cartRepository.create).toHaveBeenCalledWith({
        customerId,
        details: [],
      });
      expect(cartRepository.save).toHaveBeenCalled();
    });

    it('should return cart with doctor details', async () => {
      const customerId = 'customer-1';
      const doctorId = 'doctor-1';
      const mockDoctor = {
        id: doctorId,
        full_name: 'Dr. John Doe',
        specialization: 'Massage Therapy',
        avatar: 'avatar.jpg',
        biography: 'Expert therapist',
        experience_years: 5,
      };

      const mockService = {
        id: 'service-1',
        name: 'Massage',
        description: 'Relaxing massage',
        price: 100000,
        images: ['img1.jpg'],
        categoryId: 'cat-1',
      };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [
          {
            service: mockService,
            quantity: 1,
            doctorId,
          },
        ],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      doctorRepository.findOne.mockResolvedValue(mockDoctor);

      const result = await service.getCartById(customerId);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].doctor).toBeDefined();
      expect(result.items[0].doctor.name).toBe('Dr. John Doe');
    });

    it('should return cart without doctor when doctorId is null', async () => {
      const customerId = 'customer-1';
      const mockService = {
        id: 'service-1',
        name: 'Massage',
        description: 'Relaxing massage',
        price: 100000,
        images: ['img1.jpg'],
        categoryId: 'cat-1',
      };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [
          {
            service: mockService,
            quantity: 1,
            doctorId: null,
          },
        ],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);

      const result = await service.getCartById(customerId);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].doctor).toBeUndefined();
    });

    it('should return cart without doctor when doctor not found', async () => {
      const customerId = 'customer-1';
      const doctorId = 'nonexistent-doctor';
      const mockService = {
        id: 'service-1',
        name: 'Massage',
        description: 'Relaxing massage',
        price: 100000,
        images: ['img1.jpg'],
        categoryId: 'cat-1',
      };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [
          {
            service: mockService,
            quantity: 1,
            doctorId,
          },
        ],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      doctorRepository.findOne.mockResolvedValue(null);

      const result = await service.getCartById(customerId);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].doctor).toBeUndefined();
    });
  });

  describe('addItemToCart', () => {
    it('should add item to cart successfully', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';
      const doctorId = 'doctor-1';
      const itemData = { itemId, quantity: 1 };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      const mockService = {
        id: itemId,
        name: 'Test Service',
        price: 100000,
        doctors: [{ id: doctorId }],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      serviceRepository.findOne.mockResolvedValue(mockService);
      cartDetailRepository.findOne.mockResolvedValue(null);
      cartDetailRepository.create.mockReturnValue({
        cart: mockCart,
        service: mockService,
        quantity: 1,
        doctorId,
      });
      cartDetailRepository.save.mockResolvedValue({});
      doctorRepository.findOne.mockResolvedValue({ id: doctorId, full_name: 'Dr. Test' });
      cartRepository.findOne.mockResolvedValueOnce(mockCart).mockResolvedValueOnce({
        ...mockCart,
        details: [{ service: mockService, doctorId, quantity: 1 }],
      });

      const result = await service.addItemToCart(customerId, itemData, doctorId);

      expect(result).toBeDefined();
      expect(serviceRepository.findOne).toHaveBeenCalledWith({
        where: { id: itemId },
        relations: ['doctors'],
      });
      expect(cartDetailRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when service not found', async () => {
      const customerId = 'customer-1';
      const itemId = 'nonexistent-service';
      const doctorId = 'doctor-1';
      const itemData = { itemId, quantity: 1 };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      serviceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addItemToCart(customerId, itemData, doctorId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when doctor is not allowed for service', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';
      const doctorId = 'wrong-doctor';
      const itemData = { itemId, quantity: 1 };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      const mockService = {
        id: itemId,
        name: 'Test Service',
        doctors: [{ id: 'other-doctor' }],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      serviceRepository.findOne.mockResolvedValue(mockService);

      await expect(
        service.addItemToCart(customerId, itemData, doctorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when item already exists in cart', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';
      const doctorId = 'doctor-1';
      const itemData = { itemId, quantity: 1 };

      const mockService = {
        id: itemId,
        name: 'Test Service',
        doctors: [{ id: doctorId }],
      };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [
          {
            service: mockService,
            doctorId,
          },
        ],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      serviceRepository.findOne.mockResolvedValue(mockService);
      cartDetailRepository.findOne.mockResolvedValue({
        id: 'existing-detail',
        serviceId: itemId,
        doctorId,
        cart: mockCart,
      });

      await expect(
        service.addItemToCart(customerId, itemData, doctorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add item to cart without doctorId', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';
      const itemData = { itemId, quantity: 1 };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      const mockService = {
        id: itemId,
        name: 'Test Service',
        price: 100000,
        doctors: [],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      serviceRepository.findOne.mockResolvedValue(mockService);
      cartDetailRepository.findOne.mockResolvedValue(null);
      cartDetailRepository.create.mockReturnValue({
        cart: mockCart,
        service: mockService,
        quantity: 1,
        doctorId: null,
      });
      cartDetailRepository.save.mockResolvedValue({});
      cartRepository.findOne.mockResolvedValueOnce(mockCart).mockResolvedValueOnce({
        ...mockCart,
        details: [{ service: mockService, doctorId: null, quantity: 1 }],
      });

      const result = await service.addItemToCart(customerId, itemData, null);

      expect(result).toBeDefined();
      expect(cartDetailRepository.save).toHaveBeenCalled();
    });

    it('should create new cart and add item when cart does not exist', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';
      const itemData = { itemId, quantity: 1 };

      const newCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      const mockService = {
        id: itemId,
        name: 'Test Service',
        price: 100000,
        doctors: [],
      };

      cartRepository.findOne.mockResolvedValueOnce(null);
      cartRepository.create.mockReturnValue(newCart);
      cartRepository.save.mockResolvedValue(newCart);
      serviceRepository.findOne.mockResolvedValue(mockService);
      cartDetailRepository.findOne.mockResolvedValue(null);
      cartDetailRepository.create.mockReturnValue({
        cart: newCart,
        service: mockService,
        quantity: 1,
        doctorId: null,
      });
      cartDetailRepository.save.mockResolvedValue({});
      cartRepository.findOne.mockResolvedValueOnce(newCart).mockResolvedValueOnce({
        ...newCart,
        details: [{ service: mockService, doctorId: null, quantity: 1 }],
      });

      const result = await service.addItemToCart(customerId, itemData, null);

      expect(result).toBeDefined();
      expect(cartRepository.create).toHaveBeenCalledWith({
        customerId,
        details: [],
      });
      expect(cartRepository.save).toHaveBeenCalled();
    });
  });

  describe('removeItemFromCart', () => {
    it('should remove item from cart successfully', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';

      const mockService = { id: itemId };
      const mockDetail = {
        id: 'detail-1',
        serviceId: itemId,
        service: mockService,
      };

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [mockDetail],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      cartDetailRepository.delete.mockResolvedValue({});
      cartRepository.findOne.mockResolvedValueOnce(mockCart).mockResolvedValueOnce({
        ...mockCart,
        details: [],
      });

      const result = await service.removeItemFromCart(customerId, itemId);

      expect(result).toBeDefined();
      expect(cartDetailRepository.delete).toHaveBeenCalledWith(mockDetail.id);
    });

    it('should throw NotFoundException when cart not found', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';

      cartRepository.findOne.mockResolvedValue(null);

      await expect(service.removeItemFromCart(customerId, itemId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when item not in cart', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';

      const mockCart = {
        id: 'cart-1',
        customerId,
        details: [],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);

      await expect(service.removeItemFromCart(customerId, itemId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart successfully', async () => {
      const cartId = 'cart-1';
      const customerId = 'customer-1';

      const mockDetail1 = { id: 'detail-1' };
      const mockDetail2 = { id: 'detail-2' };

      const mockCart = {
        id: cartId,
        customerId,
        details: [mockDetail1, mockDetail2],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);
      cartDetailRepository.remove.mockResolvedValue({});
      cartRepository.findOne.mockResolvedValueOnce(mockCart).mockResolvedValueOnce({
        ...mockCart,
        details: [],
      });

      const result = await service.clearCart(cartId);

      expect(result).toBeDefined();
      expect(cartDetailRepository.remove).toHaveBeenCalledWith([mockDetail1, mockDetail2]);
    });

    it('should throw NotFoundException when cart not found', async () => {
      const cartId = 'nonexistent-cart';

      cartRepository.findOne.mockResolvedValue(null);

      await expect(service.clearCart(cartId)).rejects.toThrow(NotFoundException);
    });

    it('should handle empty cart', async () => {
      const cartId = 'cart-1';
      const customerId = 'customer-1';

      const mockCart = {
        id: cartId,
        customerId,
        details: [],
      };

      cartRepository.findOne.mockResolvedValue(mockCart);

      const result = await service.clearCart(cartId);

      expect(result).toBeDefined();
      expect(cartDetailRepository.remove).not.toHaveBeenCalled();
    });
  });
});
