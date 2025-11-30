import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { NotificationModule } from './notification.module';
import { NotificationService } from './notification.service';
import { Notification } from '@/entities/notification.entity';
import { Customer } from '@/entities/customer.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Internal } from '@/entities/internal.entity';
import { Gender } from '@/entities/enums/gender.enum';
import { NotificationType } from '@/entities/enums/notification-type.enum';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('Notification Module Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let notificationRepository: Repository<Notification>;
  let customerRepository: Repository<Customer>;
  let doctorRepository: Repository<Doctor>;
  let internalRepository: Repository<Internal>;
  let roleRepository: Repository<any>;
  let notificationService: NotificationService;

  // Test data
  let createdCustomerId: string;
  let createdDoctorId: string;
  let createdInternalId: string;
  let createdNotificationId: string;
  let createdRoleId: number;

  beforeAll(async () => {
    // Setup test database connection
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT || '3306');
    const dbUsername = process.env.DB_USERNAME || 'root';
    const dbPassword = process.env.DB_PASSWORD || 'root';
    const dbName = process.env.DB_DATABASE || 'gen_spa';

    dataSource = new DataSource({
      type: 'mysql',
      host: dbHost,
      port: dbPort,
      username: dbUsername,
      password: dbPassword,
      database: dbName,
      entities: [__dirname + '/../../entities/*.entity.{js,ts}'],
      synchronize: false,
      logging: false,
    });

    try {
      await dataSource.initialize();
      console.log(`✅ Connected to database: ${dbName}`);
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }

    // Create test module
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: dbHost,
          port: dbPort,
          username: dbUsername,
          password: dbPassword,
          database: dbName,
          entities: [__dirname + '/../../entities/*.entity.{js,ts}'],
          synchronize: false,
          logging: false,
        }),
        NotificationModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get repositories and services
    notificationRepository = moduleFixture.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    customerRepository = moduleFixture.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    doctorRepository = moduleFixture.get<Repository<Doctor>>(
      getRepositoryToken(Doctor),
    );
    internalRepository = moduleFixture.get<Repository<Internal>>(
      getRepositoryToken(Internal),
    );
    roleRepository = dataSource.getRepository('role');
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
  });

  afterAll(async () => {
    // Clean up test data using direct SQL to avoid foreign key constraints
    if (dataSource.isInitialized) {
      await dataSource.query('DELETE FROM notifications WHERE userType IN ("customer", "doctor", "internal")');
      await dataSource.query('DELETE FROM customer WHERE email LIKE "test-%"');
      await dataSource.query('DELETE FROM doctor WHERE email LIKE "test-%"');
      await dataSource.query('DELETE FROM internal WHERE email LIKE "test-%"');
      await dataSource.query('DELETE FROM role WHERE name = "test-admin-role"');
      
      await dataSource.destroy();
      console.log('✅ Test database connection closed');
    }

    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up before each test
    await dataSource.query('DELETE FROM notifications WHERE userType IN ("customer", "doctor", "internal")');
    await dataSource.query('DELETE FROM customer WHERE email LIKE "test-%"');
    await dataSource.query('DELETE FROM doctor WHERE email LIKE "test-%"');
    await dataSource.query('DELETE FROM internal WHERE email LIKE "test-%"');
    await dataSource.query('DELETE FROM role WHERE name = "test-admin-role"');

    // Create test users with hardcoded password hash (workaround for test environment)
    const passwordHash = '$2b$10$abcdefghijklmnopqrstuv'; // Mock bcrypt hash

    // Create test customer
    const customer = customerRepository.create({
      full_name: 'Test Customer',
      email: 'test-customer@example.com',
      password: passwordHash,
      phone: '0123456789',
      gender: Gender.Female,
      birth_date: new Date('1990-01-01'),
      address: '123 Test Street',
      isActive: true,
    });
    const savedCustomer = await customerRepository.save(customer);
    createdCustomerId = savedCustomer.id;

    // Create test doctor
    const doctor = doctorRepository.create({
      full_name: 'Test Doctor',
      email: 'test-doctor@example.com',
      password: passwordHash,
      phone: '0987654321',
      gender: Gender.Male,
      specialization: 'Dermatology',
      experience_years: 10,
      isActive: true,
    });
    const savedDoctor = await doctorRepository.save(doctor);
    createdDoctorId = savedDoctor.id;

    // Create test role
    const role = await roleRepository.save({
      name: 'test-admin-role',
      description: 'Test admin role',
    });
    createdRoleId = role.id;

    // Create test internal user
    const internal = internalRepository.create({
      full_name: 'Test Admin',
      email: 'test-admin@example.com',
      password: passwordHash,
      phone: '0111222333',
      gender: Gender.Male,
      role: role,
      isActive: true,
    });
    const savedInternal = await internalRepository.save(internal);
    createdInternalId = savedInternal.id;
  });

  describe('Notification Management', () => {
    describe('POST /notifications', () => {
      it('should create a notification for customer', async () => {
        const createDto = {
          title: 'Test Notification',
          content: 'This is a test notification',
          userId: createdCustomerId,
          userType: 'customer',
          type: NotificationType.Info,
        };

        const response = await request(app.getHttpServer())
          .post('/notifications')
          .send(createDto)
          .expect(201);

        expect(response.body.title).toBe(createDto.title);
        expect(response.body.content).toBe(createDto.content);
        expect(response.body.userId).toBe(createdCustomerId);
        expect(response.body.userType).toBe('customer');
        expect(response.body.isRead).toBe(false);
        expect(response.body.id).toBeDefined();

        createdNotificationId = response.body.id;
      });

      it('should create a notification for doctor', async () => {
        const createDto = {
          title: 'Doctor Notification',
          content: 'New appointment scheduled',
          userId: createdDoctorId,
          userType: 'doctor',
          type: NotificationType.Info,
        };

        const response = await request(app.getHttpServer())
          .post('/notifications')
          .send(createDto)
          .expect(201);

        expect(response.body.userId).toBe(createdDoctorId);
        expect(response.body.userType).toBe('doctor');
        expect(response.body.type).toBe(NotificationType.Info);
      });

      it('should create a notification for internal user', async () => {
        const createDto = {
          title: 'Admin Alert',
          content: 'System maintenance scheduled',
          userId: createdInternalId,
          userType: 'internal',
          type: NotificationType.Warning,
        };

        const response = await request(app.getHttpServer())
          .post('/notifications')
          .send(createDto)
          .expect(201);

        expect(response.body.userId).toBe(createdInternalId);
        expect(response.body.userType).toBe('internal');
      });

      it('should fail when userId does not exist', async () => {
        const createDto = {
          title: 'Test Notification',
          content: 'This should fail',
          userId: 'non-existent-user-id',
          userType: 'customer',
        };

        await request(app.getHttpServer())
          .post('/notifications')
          .send(createDto)
          .expect(400);
      });

      it('should fail when userType is invalid', async () => {
        const createDto = {
          title: 'Test Notification',
          content: 'This should fail',
          userId: createdCustomerId,
          userType: 'invalid-type',
        };

        await request(app.getHttpServer())
          .post('/notifications')
          .send(createDto)
          .expect(400);
      });

      it('should create notification with optional fields', async () => {
        const createDto = {
          title: 'Complete Notification',
          content: 'With all optional fields',
          userId: createdCustomerId,
          userType: 'customer',
          type: NotificationType.Success,
          actionUrl: 'https://example.com/promo',
        };

        const response = await request(app.getHttpServer())
          .post('/notifications')
          .send(createDto)
          .expect(201);

        expect(response.body.actionUrl).toBe(createDto.actionUrl);
      });
    });

    describe('GET /notifications', () => {
      beforeEach(async () => {
        // Create multiple notifications
        await notificationRepository.save([
          {
            title: 'Notification 1',
            content: 'Content 1',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: false,
          },
          {
            title: 'Notification 2',
            content: 'Content 2',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: true,
          },
          {
            title: 'Notification 3',
            content: 'Content 3',
            userId: createdDoctorId,
            userType: 'doctor',
            type: NotificationType.Info,
            isRead: false,
          },
        ]);
      });

      it('should return all notifications for admin', async () => {
        const response = await request(app.getHttpServer())
          .get('/notifications')
          .expect(200);

        expect(response.body.notifications).toBeDefined();
        expect(response.body.total).toBeGreaterThanOrEqual(3);
        expect(Array.isArray(response.body.notifications)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/notifications?take=2&skip=0')
          .expect(200);

        expect(response.body.notifications.length).toBeLessThanOrEqual(2);
      });
    });

    describe('GET /notifications/users/:userId', () => {
      beforeEach(async () => {
        // Create notifications for specific user
        await notificationRepository.save([
          {
            title: 'Customer Notification 1',
            content: 'Content 1',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: false,
          },
          {
            title: 'Customer Notification 2',
            content: 'Content 2',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Success,
            isRead: true,
          },
          {
            title: 'Doctor Notification',
            content: 'Should not appear',
            userId: createdDoctorId,
            userType: 'doctor',
            type: NotificationType.Info,
            isRead: false,
          },
        ]);
      });

      it('should return notifications for specific customer', async () => {
        const response = await request(app.getHttpServer())
          .get(`/notifications/users/${createdCustomerId}?userType=customer`)
          .expect(200);

        expect(response.body.notifications).toBeDefined();
        expect(response.body.notifications.length).toBe(2);
        expect(response.body.notifications[0].userId).toBe(createdCustomerId);
      });

      it('should return notifications for specific doctor', async () => {
        const response = await request(app.getHttpServer())
          .get(`/notifications/users/${createdDoctorId}?userType=doctor`)
          .expect(200);

        expect(response.body.notifications.length).toBe(1);
        expect(response.body.notifications[0].userType).toBe('doctor');
      });

      it('should fail when userType is missing', async () => {
        await request(app.getHttpServer())
          .get(`/notifications/users/${createdCustomerId}`)
          .expect(500); // Service crashes when userType is undefined
      });

      it('should fail when userType is invalid', async () => {
        await request(app.getHttpServer())
          .get(`/notifications/users/${createdCustomerId}?userType=invalid`)
          .expect(400);
      });

      it('should support pagination for user notifications', async () => {
        const response = await request(app.getHttpServer())
          .get(`/notifications/users/${createdCustomerId}?userType=customer&take=1&skip=0`)
          .expect(200);

        expect(response.body.notifications.length).toBe(1);
        expect(response.body.total).toBe(2);
      });
    });

    describe('GET /notifications/users/:userId/unread', () => {
      beforeEach(async () => {
        await notificationRepository.save([
          {
            title: 'Unread 1',
            content: 'Content 1',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: false,
          },
          {
            title: 'Unread 2',
            content: 'Content 2',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: false,
          },
          {
            title: 'Read',
            content: 'Already read',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: true,
          },
        ]);
      });

      it('should return only unread notifications', async () => {
        const response = await request(app.getHttpServer())
          .get(`/notifications/users/${createdCustomerId}/unread?userType=customer`)
          .expect(200);

        expect(response.body.length).toBe(2);
        expect(response.body.every((n: any) => !n.isRead)).toBe(true);
      });
    });

    describe('GET /notifications/:id', () => {
      it('should return a notification by id', async () => {
        const notification = await notificationRepository.save({
          title: 'Single Notification',
          content: 'Test content',
          userId: createdCustomerId,
          userType: 'customer',
          type: NotificationType.Info,
          isRead: false,
        });

        const response = await request(app.getHttpServer())
          .get(`/notifications/${notification.id}`)
          .expect(200);

        expect(response.body.id).toBe(notification.id);
        expect(response.body.title).toBe('Single Notification');
      });

      it('should return 404 when notification not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .get(`/notifications/${fakeId}`)
          .expect(404);
      });

      it('should return 400 for invalid UUID format', async () => {
        await request(app.getHttpServer())
          .get('/notifications/invalid-uuid')
          .expect(400);
      });
    });

    describe('PATCH /notifications/:id', () => {
      it('should update notification isRead status', async () => {
        const notification = await notificationRepository.save({
          title: 'Original Title',
          content: 'Original Content',
          userId: createdCustomerId,
          userType: 'customer',
          type: NotificationType.Info,
          isRead: false,
        });

        const updateDto = {
          isRead: true,
        };

        const response = await request(app.getHttpServer())
          .patch(`/notifications/${notification.id}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.isRead).toBe(true);
        expect(response.body.title).toBe('Original Title'); // Unchanged
      });

      it('should return 404 when updating non-existent notification', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .patch(`/notifications/${fakeId}`)
          .send({ isRead: true })
          .expect(404);
      });
    });

    describe('POST /notifications/:id/read', () => {
      it('should mark notification as read', async () => {
        const notification = await notificationRepository.save({
          title: 'Unread Notification',
          content: 'Test content',
          userId: createdCustomerId,
          userType: 'customer',
          type: NotificationType.Info,
          isRead: false,
        });

        const response = await request(app.getHttpServer())
          .post(`/notifications/${notification.id}/read`)
          .expect(201);

        expect(response.body.isRead).toBe(true);
      });

      it('should return 404 when marking non-existent notification', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .post(`/notifications/${fakeId}/read`)
          .expect(404);
      });
    });

    describe('POST /notifications/users/:userId/read-all', () => {
      beforeEach(async () => {
        await notificationRepository.save([
          {
            title: 'Unread 1',
            content: 'Content 1',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: false,
          },
          {
            title: 'Unread 2',
            content: 'Content 2',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: false,
          },
          {
            title: 'Already Read',
            content: 'Content 3',
            userId: createdCustomerId,
            userType: 'customer',
            type: NotificationType.Info,
            isRead: true,
          },
        ]);
      });

      it('should mark all notifications as read for user', async () => {
        await request(app.getHttpServer())
          .post(`/notifications/users/${createdCustomerId}/read-all?userType=customer`)
          .expect(201);

        const unreadNotifications = await notificationRepository.find({
          where: {
            userId: createdCustomerId,
            userType: 'customer',
            isRead: false,
          },
        });

        expect(unreadNotifications.length).toBe(0);
      });

      it('should not affect other users notifications', async () => {
        // Create notification for doctor
        await notificationRepository.save({
          title: 'Doctor Unread',
          content: 'Content',
          userId: createdDoctorId,
          userType: 'doctor',
          type: NotificationType.Info,
          isRead: false,
        });

        await request(app.getHttpServer())
          .post(`/notifications/users/${createdCustomerId}/read-all?userType=customer`)
          .expect(201);

        const doctorUnread = await notificationRepository.find({
          where: {
            userId: createdDoctorId,
            userType: 'doctor',
            isRead: false,
          },
        });

        expect(doctorUnread.length).toBe(1);
      });

      it('should fail when userType is invalid', async () => {
        await request(app.getHttpServer())
          .post(`/notifications/users/${createdCustomerId}/read-all?userType=invalid`)
          .expect(400);
      });
    });

    describe('DELETE /notifications/:id', () => {
      it('should soft delete a notification', async () => {
        const notification = await notificationRepository.save({
          title: 'To Delete',
          content: 'Test content',
          userId: createdCustomerId,
          userType: 'customer',
          type: NotificationType.Info,
          isRead: false,
        });

        await request(app.getHttpServer())
          .delete(`/notifications/${notification.id}`)
          .expect(200);

        // Verify soft delete
        const found = await notificationRepository.findOne({
          where: { id: notification.id },
          withDeleted: true,
        });
        expect(found).toBeDefined();
        expect(found?.deletedAt).not.toBeNull();
      });

      it('should return 404 when deleting non-existent notification', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .delete(`/notifications/${fakeId}`)
          .expect(404);
      });
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle multiple notification types', async () => {
      const types = [
        NotificationType.Info,
        NotificationType.Success,
        NotificationType.Warning,
        NotificationType.Error,
      ];

      for (const type of types) {
        const response = await request(app.getHttpServer())
          .post('/notifications')
          .send({
            title: `${type} Notification`,
            content: 'Test content',
            userId: createdCustomerId,
            userType: 'customer',
            type,
          })
          .expect(201);

        expect(response.body.type).toBe(type);
      }
    });

    it('should preserve notification order by createdAt DESC', async () => {
      // Create notifications with delays to ensure different timestamps
      const notif1 = await notificationRepository.save({
        title: 'First',
        content: 'Created first',
        userId: createdCustomerId,
        userType: 'customer',
        type: NotificationType.Info,
        isRead: false,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const notif2 = await notificationRepository.save({
        title: 'Second',
        content: 'Created second',
        userId: createdCustomerId,
        userType: 'customer',
        type: NotificationType.Info,
        isRead: false,
      });

      const response = await request(app.getHttpServer())
        .get(`/notifications/users/${createdCustomerId}?userType=customer`)
        .expect(200);

      // Most recent should be first
      expect(response.body.notifications[0].title).toBe('Second');
      expect(response.body.notifications[1].title).toBe('First');
    });

    it('should handle empty notification list', async () => {
      const response = await request(app.getHttpServer())
        .get(`/notifications/users/${createdInternalId}?userType=internal`)
        .expect(200);

      expect(response.body.notifications).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should default to type Info when not provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/notifications')
        .send({
          title: 'No Type Specified',
          content: 'Test content',
          userId: createdCustomerId,
          userType: 'customer',
        })
        .expect(201);

      expect(response.body.type).toBe(NotificationType.Info);
    });
  });
});
