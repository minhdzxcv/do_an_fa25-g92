import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CartController', () => {
  let controller: CartController;
  let service: CartService;

  const mockCartService = {
    getCartById: jest.fn(),
    addItemToCart: jest.fn(),
    removeItemFromCart: jest.fn(),
    clearCart: jest.fn(),
  };

  const mockCart = {
    id: 'cart-1',
    items: [
      {
        id: 'service-1',
        name: 'Massage Service',
        description: 'Relaxing massage',
        price: 100000,
        quantity: 1,
        images: ['img1.jpg'],
        categoryId: 'cat-1',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        {
          provide: CartService,
          useValue: mockCartService,
        },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCart', () => {
    it('should return cart for customer', async () => {
      const customerId = 'customer-1';
      mockCartService.getCartById.mockResolvedValue(mockCart);

      const result = await controller.getCart(customerId);

      expect(service.getCartById).toHaveBeenCalledWith(customerId);
      expect(result).toEqual(mockCart);
      expect(result.items).toHaveLength(1);
    });

    it('should return empty cart for new customer', async () => {
      const customerId = 'new-customer';
      const emptyCart = {
        id: 'cart-2',
        items: [],
      };

      mockCartService.getCartById.mockResolvedValue(emptyCart);

      const result = await controller.getCart(customerId);

      expect(service.getCartById).toHaveBeenCalledWith(customerId);
      expect(result.items).toHaveLength(0);
    });

    it('should return cart with doctor details', async () => {
      const customerId = 'customer-1';
      const cartWithDoctor = {
        id: 'cart-1',
        items: [
          {
            id: 'service-1',
            name: 'Massage',
            price: 100000,
            quantity: 1,
            doctor: {
              id: 'doctor-1',
              name: 'Dr. John Doe',
              specialization: 'Massage Therapy',
            },
          },
        ],
      };

      mockCartService.getCartById.mockResolvedValue(cartWithDoctor);

      const result = await controller.getCart(customerId);

      expect(result.items[0].doctor).toBeDefined();
      expect(result.items[0].doctor.name).toBe('Dr. John Doe');
    });
  });

  describe('addItemToCart', () => {
    it('should add item to cart successfully', async () => {
      const customerId = 'customer-1';
      const itemData = { itemId: 'service-1', quantity: 1 };
      const doctorId = 'doctor-1';

      mockCartService.addItemToCart.mockResolvedValue(mockCart);

      const result = await controller.addItemToCart(customerId, itemData, doctorId);

      expect(service.addItemToCart).toHaveBeenCalledWith(customerId, itemData, doctorId);
      expect(result).toEqual(mockCart);
    });

    it('should add item without doctor', async () => {
      const customerId = 'customer-1';
      const itemData = { itemId: 'service-1', quantity: 2 };

      mockCartService.addItemToCart.mockResolvedValue(mockCart);

      const result = await controller.addItemToCart(customerId, itemData, '');

      expect(service.addItemToCart).toHaveBeenCalledWith(customerId, itemData, '');
      expect(result).toBeDefined();
    });

    it('should add item with default quantity 1', async () => {
      const customerId = 'customer-1';
      const itemData = { itemId: 'service-1' };
      const doctorId = 'doctor-1';

      mockCartService.addItemToCart.mockResolvedValue(mockCart);

      const result = await controller.addItemToCart(customerId, itemData, doctorId);

      expect(service.addItemToCart).toHaveBeenCalledWith(customerId, itemData, doctorId);
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when service not found', async () => {
      const customerId = 'customer-1';
      const itemData = { itemId: 'nonexistent-service', quantity: 1 };
      const doctorId = 'doctor-1';

      mockCartService.addItemToCart.mockRejectedValue(
        new NotFoundException('Không tìm thấy dịch vụ'),
      );

      await expect(
        controller.addItemToCart(customerId, itemData, doctorId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when doctor not allowed for service', async () => {
      const customerId = 'customer-1';
      const itemData = { itemId: 'service-1', quantity: 1 };
      const doctorId = 'wrong-doctor';

      mockCartService.addItemToCart.mockRejectedValue(
        new BadRequestException('Bác sĩ không được phép thêm dịch vụ này vào giỏ hàng'),
      );

      await expect(
        controller.addItemToCart(customerId, itemData, doctorId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when item already in cart', async () => {
      const customerId = 'customer-1';
      const itemData = { itemId: 'service-1', quantity: 1 };
      const doctorId = 'doctor-1';

      mockCartService.addItemToCart.mockRejectedValue(
        new BadRequestException('Dịch vụ này đã có trong giỏ hàng'),
      );

      await expect(
        controller.addItemToCart(customerId, itemData, doctorId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeItemFromCart', () => {
    it('should remove item from cart successfully', async () => {
      const customerId = 'customer-1';
      const itemId = 'service-1';
      const updatedCart = {
        id: 'cart-1',
        items: [],
      };

      mockCartService.removeItemFromCart.mockResolvedValue(updatedCart);

      const result = await controller.removeItemFromCart(customerId, itemId);

      expect(service.removeItemFromCart).toHaveBeenCalledWith(customerId, itemId);
      expect(result).toEqual(updatedCart);
      expect(result.items).toHaveLength(0);
    });

    it('should throw NotFoundException when cart not found', async () => {
      const customerId = 'nonexistent-customer';
      const itemId = 'service-1';

      mockCartService.removeItemFromCart.mockRejectedValue(
        new NotFoundException('Không tìm thấy giỏ hàng'),
      );

      await expect(
        controller.removeItemFromCart(customerId, itemId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when item not in cart', async () => {
      const customerId = 'customer-1';
      const itemId = 'nonexistent-item';

      mockCartService.removeItemFromCart.mockRejectedValue(
        new BadRequestException('Sản phẩm không tồn tại trong giỏ hàng'),
      );

      await expect(
        controller.removeItemFromCart(customerId, itemId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart successfully', async () => {
      const customerId = 'customer-1';
      const emptyCart = {
        id: 'cart-1',
        items: [],
      };

      mockCartService.clearCart.mockResolvedValue(emptyCart);

      const result = await controller.clearCart(customerId);

      expect(service.clearCart).toHaveBeenCalledWith(customerId);
      expect(result).toEqual(emptyCart);
      expect(result.items).toHaveLength(0);
    });

    it('should throw NotFoundException when cart not found', async () => {
      const customerId = 'nonexistent-customer';

      mockCartService.clearCart.mockRejectedValue(
        new NotFoundException('Không tìm thấy giỏ hàng'),
      );

      await expect(controller.clearCart(customerId)).rejects.toThrow(NotFoundException);
    });

    it('should handle already empty cart', async () => {
      const customerId = 'customer-1';
      const emptyCart = {
        id: 'cart-1',
        items: [],
      };

      mockCartService.clearCart.mockResolvedValue(emptyCart);

      const result = await controller.clearCart(customerId);

      expect(result.items).toHaveLength(0);
    });
  });
});
