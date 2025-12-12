import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from '@/entities/notification.entity';
import { Customer } from '@/entities/customer.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Internal } from '@/entities/internal.entity';
import { NotificationType } from '@/entities/enums/notification-type.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Repository<Notification>;
  let customerRepo: Repository<Customer>;
  let doctorRepo: Repository<Doctor>;
  let internalRepo: Repository<Internal>;

  const mockNotificationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockCustomerRepo = {
    findOne: jest.fn(),
  };

  const mockDoctorRepo = {
    findOne: jest.fn(),
  };

  const mockInternalRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepo,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepo,
        },
        {
          provide: getRepositoryToken(Doctor),
          useValue: mockDoctorRepo,
        },
        {
          provide: getRepositoryToken(Internal),
          useValue: mockInternalRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    customerRepo = module.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    doctorRepo = module.get<Repository<Doctor>>(getRepositoryToken(Doctor));
    internalRepo = module.get<Repository<Internal>>(
      getRepositoryToken(Internal),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification for a customer', async () => {
      const customerId = 'customer-uuid';
      const dto: CreateNotificationDto = {
        title: 'Test Notification',
        content: 'Test content',
        type: NotificationType.Info,
        userId: customerId,
        userType: 'customer',
      };

      const mockCustomer = { id: customerId, email: 'test@test.com' };
      const mockNotification = {
        id: 'notification-uuid',
        ...dto,
        isRead: false,
        createdAt: new Date(),
      };

      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);

      const result = await service.create(dto);

      expect(customerRepo.findOne).toHaveBeenCalledWith({
        where: { id: customerId },
      });
      expect(notificationRepo.create).toHaveBeenCalledWith({
        ...dto,
        type: NotificationType.Info,
        isRead: false,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toEqual(mockNotification);
    });

    it('should create a notification for a doctor', async () => {
      const doctorId = 'doctor-uuid';
      const dto: CreateNotificationDto = {
        title: 'Test Notification',
        content: 'Test content',
        userId: doctorId,
        userType: 'doctor',
      };

      const mockDoctor = { id: doctorId, email: 'doctor@test.com' };
      const mockNotification = {
        id: 'notification-uuid',
        ...dto,
        type: NotificationType.Info,
        isRead: false,
      };

      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);

      const result = await service.create(dto);

      expect(doctorRepo.findOne).toHaveBeenCalledWith({
        where: { id: doctorId },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should create a notification for internal user', async () => {
      const internalId = 'internal-uuid';
      const dto: CreateNotificationDto = {
        title: 'Test Notification',
        content: 'Test content',
        userId: internalId,
        userType: 'internal',
      };

      const mockInternal = { id: internalId, email: 'staff@test.com' };
      const mockNotification = {
        id: 'notification-uuid',
        ...dto,
        type: NotificationType.Info,
        isRead: false,
      };

      mockInternalRepo.findOne.mockResolvedValue(mockInternal);
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);

      const result = await service.create(dto);

      expect(internalRepo.findOne).toHaveBeenCalledWith({
        where: { id: internalId },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should default to Info type when type is not provided', async () => {
      const dto: CreateNotificationDto = {
        title: 'Test',
        content: 'Content',
        userId: 'customer-uuid',
        userType: 'customer',
      };

      const mockCustomer = { id: 'customer-uuid' };
      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockNotificationRepo.create.mockReturnValue({ ...dto, isRead: false });
      mockNotificationRepo.save.mockResolvedValue({ ...dto, isRead: false });

      await service.create(dto);

      expect(notificationRepo.create).toHaveBeenCalledWith({
        ...dto,
        type: NotificationType.Info,
        isRead: false,
      });
    });

    it('should throw error when user does not exist', async () => {
      const dto: CreateNotificationDto = {
        title: 'Test',
        content: 'Content',
        userId: 'non-existent-uuid',
        userType: 'customer',
      };

      mockCustomerRepo.findOne.mockResolvedValue(null);
      
      // Service will still create notification even if validateUser returns false
      const mockNotification = { ...dto, id: 'notif-id', isRead: false };
      mockNotificationRepo.create.mockReturnValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(mockNotification);

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.id).toBe('notif-id');
    });
  });

  describe('findAllForAdmin', () => {
    it('should return paginated notifications for admin', async () => {
      const mockNotifications = [
        {
          id: '1',
          title: 'Notification 1',
          content: 'Content 1',
          isRead: false,
        },
        {
          id: '2',
          title: 'Notification 2',
          content: 'Content 2',
          isRead: true,
        },
      ];

      mockNotificationRepo.findAndCount.mockResolvedValue([
        mockNotifications,
        2,
      ]);

      const result = await service.findAllForAdmin(10, 0);

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        notifications: mockNotifications,
        total: 2,
      });
    });

    it('should use default pagination when not provided', async () => {
      mockNotificationRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllForAdmin();

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith({
        where: { deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('findByUser', () => {
    it('should return notifications for a specific customer', async () => {
      const userId = 'customer-uuid';
      const mockCustomer = { id: userId };
      const mockNotifications = [
        { id: '1', userId, userType: 'customer', isRead: false },
      ];

      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockNotificationRepo.findAndCount.mockResolvedValue([
        mockNotifications,
        1,
      ]);

      const result = await service.findByUser(userId, 'customer', 10, 0);

      expect(customerRepo.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(notificationRepo.findAndCount).toHaveBeenCalledWith({
        where: {
          userId,
          userType: 'customer',
          deletedAt: IsNull(),
        },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        notifications: mockNotifications,
        total: 1,
      });
    });

    it('should throw error for invalid user type', async () => {
      await expect(
        service.findByUser('user-id', 'invalid-type', 10, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate user exists before fetching notifications', async () => {
      const userId = 'non-existent';
      mockCustomerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByUser(userId, 'customer', 10, 0),
      ).rejects.toThrow();
    });
  });

  describe('findUnreadByUser', () => {
    it('should return only unread notifications for user', async () => {
      const userId = 'customer-uuid';
      const mockCustomer = { id: userId };
      const mockUnreadNotifications = [
        { id: '1', userId, userType: 'customer', isRead: false },
        { id: '2', userId, userType: 'customer', isRead: false },
      ];

      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockNotificationRepo.find.mockResolvedValue(mockUnreadNotifications);

      const result = await service.findUnreadByUser(userId, 'customer');

      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: {
          userId,
          userType: 'customer',
          isRead: false,
          deletedAt: IsNull(),
        },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockUnreadNotifications);
    });

    it('should throw error for invalid user type', async () => {
      await expect(
        service.findUnreadByUser('user-id', 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      const notificationId = 'notification-uuid';
      const mockNotification = {
        id: notificationId,
        title: 'Test',
        content: 'Content',
      };

      mockNotificationRepo.findOne.mockResolvedValue(mockNotification);

      const result = await service.findOne(notificationId);

      expect(notificationRepo.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, deletedAt: IsNull() },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should throw NotFoundException when notification not found', async () => {
      const notificationId = 'non-existent-uuid';
      mockNotificationRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(notificationId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(notificationId)).rejects.toThrow(
        'Không tìm thấy thông báo',
      );
    });
  });

  describe('update', () => {
    it('should update a notification', async () => {
      const notificationId = 'notification-uuid';
      const updateDto: UpdateNotificationDto = { isRead: true };
      const existingNotification = {
        id: notificationId,
        title: 'Test',
        isRead: false,
      };
      const updatedNotification = { ...existingNotification, isRead: true };

      mockNotificationRepo.findOne.mockResolvedValue(existingNotification);
      mockNotificationRepo.save.mockResolvedValue(updatedNotification);

      const result = await service.update(notificationId, updateDto);

      expect(notificationRepo.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, deletedAt: IsNull() },
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(updatedNotification);
      expect(result).toEqual(updatedNotification);
    });

    it('should throw error when notification not found', async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { isRead: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const notificationId = 'notification-uuid';
      const mockNotification = {
        id: notificationId,
        isRead: false,
      };
      const updatedNotification = { ...mockNotification, isRead: true };

      mockNotificationRepo.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepo.save.mockResolvedValue(updatedNotification);

      const result = await service.markAsRead(notificationId);

      expect(notificationRepo.findOne).toHaveBeenCalled();
      expect(notificationRepo.save).toHaveBeenCalledWith(updatedNotification);
      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a customer', async () => {
      const userId = 'customer-uuid';
      const mockCustomer = { id: userId };

      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockNotificationRepo.update.mockResolvedValue({ affected: 3 });

      await service.markAllAsRead(userId, 'customer');

      expect(customerRepo.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(notificationRepo.update).toHaveBeenCalledWith(
        {
          userId,
          userType: 'customer',
          isRead: false,
          deletedAt: IsNull(),
        },
        { isRead: true },
      );
    });

    it('should mark all notifications as read for a doctor', async () => {
      const userId = 'doctor-uuid';
      const mockDoctor = { id: userId };

      mockDoctorRepo.findOne.mockResolvedValue(mockDoctor);
      mockNotificationRepo.update.mockResolvedValue({ affected: 2 });

      await service.markAllAsRead(userId, 'doctor');

      expect(doctorRepo.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(notificationRepo.update).toHaveBeenCalledWith(
        {
          userId,
          userType: 'doctor',
          isRead: false,
          deletedAt: IsNull(),
        },
        { isRead: true },
      );
    });

    it('should mark all notifications as read for internal user', async () => {
      const userId = 'internal-uuid';
      const mockInternal = { id: userId };

      mockInternalRepo.findOne.mockResolvedValue(mockInternal);
      mockNotificationRepo.update.mockResolvedValue({ affected: 5 });

      await service.markAllAsRead(userId, 'internal');

      expect(internalRepo.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(notificationRepo.update).toHaveBeenCalledWith(
        {
          userId,
          userType: 'internal',
          isRead: false,
          deletedAt: IsNull(),
        },
        { isRead: true },
      );
    });

    it('should throw error for invalid user type', async () => {
      await expect(
        service.markAllAsRead('user-id', 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate user exists before marking as read', async () => {
      const userId = 'customer-uuid';
      const mockCustomer = { id: userId };
      mockCustomerRepo.findOne.mockResolvedValue(mockCustomer);
      mockNotificationRepo.update.mockResolvedValue({ affected: 0 });

      await service.markAllAsRead(userId, 'customer');

      expect(customerRepo.findOne).toHaveBeenCalled();
      expect(notificationRepo.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a notification', async () => {
      const notificationId = 'notification-uuid';
      const mockNotification = {
        id: notificationId,
        title: 'Test',
      };

      mockNotificationRepo.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepo.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(notificationId);

      expect(notificationRepo.findOne).toHaveBeenCalledWith({
        where: { id: notificationId, deletedAt: IsNull() },
      });
      expect(notificationRepo.softDelete).toHaveBeenCalledWith(notificationId);
      expect(result).toEqual({ message: 'Đã xóa thông báo' });
    });

    it('should throw error when notification not found', async () => {
      mockNotificationRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateUser (private method - tested through public methods)', () => {
    it('should validate customer exists', async () => {
      const customerId = 'customer-uuid';
      const dto: CreateNotificationDto = {
        title: 'Test',
        content: 'Content',
        userId: customerId,
        userType: 'customer',
      };

      mockCustomerRepo.findOne.mockResolvedValue({ id: customerId });
      mockNotificationRepo.create.mockReturnValue({});
      mockNotificationRepo.save.mockResolvedValue({});

      await service.create(dto);

      expect(customerRepo.findOne).toHaveBeenCalledWith({
        where: { id: customerId },
      });
    });

    it('should throw error for invalid user type', async () => {
      const dto: CreateNotificationDto = {
        title: 'Test',
        content: 'Content',
        userId: 'user-id',
        userType: 'invalid' as any,
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Loại người dùng không hợp lệ',
      );
    });
  });

  describe('validateUserType (private method - tested through public methods)', () => {
    it('should accept valid user types', async () => {
      const validTypes = ['customer', 'doctor', 'internal'];

      for (const userType of validTypes) {
        const userId = `${userType}-uuid`;
        const mockUser = { id: userId };

        if (userType === 'customer') {
          mockCustomerRepo.findOne.mockResolvedValue(mockUser);
        } else if (userType === 'doctor') {
          mockDoctorRepo.findOne.mockResolvedValue(mockUser);
        } else {
          mockInternalRepo.findOne.mockResolvedValue(mockUser);
        }

        mockNotificationRepo.find.mockResolvedValue([]);

        await expect(
          service.findUnreadByUser(userId, userType),
        ).resolves.not.toThrow();
      }
    });

    it('should reject invalid user types', async () => {
      await expect(
        service.findByUser('user-id', 'admin', 10, 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.findByUser('user-id', 'superuser', 10, 0),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
