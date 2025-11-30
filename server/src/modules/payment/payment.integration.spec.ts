// Set required environment variables before importing PaymentModule
process.env.API_KEY_PAYMENT = process.env.API_KEY_PAYMENT || 'test-api-key';
process.env.CLIENT_ID_PAYMENT = process.env.CLIENT_ID_PAYMENT || 'test-client-id';
process.env.CHECKSUM_KEY_PAYMENT =
  process.env.CHECKSUM_KEY_PAYMENT || 'test-checksum-key';

// Mock PayOS before any imports that might use it
const mockCreatePaymentLink = jest.fn().mockResolvedValue({
  checkoutUrl: 'https://payos.vn/payment/test-checkout-url',
  orderCode: 123456789,
  paymentLinkId: 'test-payment-link-id',
});

const mockPayOSInstance = {
  createPaymentLink: mockCreatePaymentLink,
};

jest.mock('@payos/node', () => {
  return jest.fn().mockImplementation(() => mockPayOSInstance);
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { PaymentModule } from './payment.module';
import { Appointment } from '@/entities/appointment.entity';
import { AppointmentDetail } from '@/entities/appointmentDetails.entity';
import { Customer } from '@/entities/customer.entity';
import { Service } from '@/entities/service.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Category } from '@/entities/category.entity';
import { Internal } from '@/entities/internal.entity';
import { Role } from '@/entities/role.entity';
import { Spa } from '@/entities/spa.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Gender } from '@/entities/enums/gender.enum';
import { AppointmentStatus } from '@/entities/enums/appointment-status';
import { MailService } from '../mail/mail.service';

describe('Payment Module Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;

  let appointmentRepo: Repository<Appointment>;
  let appointmentDetailRepo: Repository<AppointmentDetail>;
  let customerRepo: Repository<Customer>;
  let serviceRepo: Repository<Service>;
  let doctorRepo: Repository<Doctor>;
  let categoryRepo: Repository<Category>;
  let internalRepo: Repository<Internal>;
  let roleRepo: Repository<Role>;
  let spaRepo: Repository<Spa>;

  // Test data
  let customer: Customer;
  let doctor: Doctor;
  let category: Category;
  let service: Service;
  let staff: Internal;
  let role: Role;
  let spa: Spa;
  let appointment: Appointment;
  let appointmentDetail: AppointmentDetail;

  beforeAll(async () => {
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
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET || 'test-secret-key-12345',
          signOptions: { expiresIn: '1d' },
        }),
        PaymentModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue({
        confirmAppointmentDeposit: jest.fn().mockResolvedValue(undefined),
        sendThankYouForUsingServiceEmail: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    // Get repositories from module (entities available in PaymentModule)
    appointmentRepo = moduleFixture.get<Repository<Appointment>>(
      getRepositoryToken(Appointment),
    );
    appointmentDetailRepo = moduleFixture.get<Repository<AppointmentDetail>>(
      getRepositoryToken(AppointmentDetail),
    );
    customerRepo = moduleFixture.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    serviceRepo = moduleFixture.get<Repository<Service>>(
      getRepositoryToken(Service),
    );
    doctorRepo = moduleFixture.get<Repository<Doctor>>(getRepositoryToken(Doctor));
    internalRepo = moduleFixture.get<Repository<Internal>>(
      getRepositoryToken(Internal),
    );
    spaRepo = moduleFixture.get<Repository<Spa>>(getRepositoryToken(Spa));

    // Get repositories from dataSource (entities NOT in PaymentModule)
    categoryRepo = dataSource.getRepository(Category);
    roleRepo = dataSource.getRepository(Role);

    // Setup test data
    await setupTestData();
  }, 60000);

  afterAll(async () => {
    try {
      // Cleanup in correct order to avoid foreign key constraints
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
        await dataSource.query('DELETE FROM appointment_detail');
        await dataSource.query('DELETE FROM appointment');
        await dataSource.query('DELETE FROM service');
        await dataSource.query('DELETE FROM doctor');
        await dataSource.query('DELETE FROM internal');
        await dataSource.query('DELETE FROM role');
        await dataSource.query('DELETE FROM category');
        await dataSource.query('DELETE FROM customer');
        await dataSource.query('DELETE FROM spa');
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
      }
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
        console.log('✅ Test database connection closed');
      }
      if (app) {
        await app.close();
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    }
  }, 30000);

  beforeEach(async () => {
    // Clean appointment data before each test
    try {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
        await dataSource.query('DELETE FROM appointment_detail');
        await dataSource.query('DELETE FROM appointment');
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
      }
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock PayOS createPaymentLink to return success
      mockCreatePaymentLink.mockResolvedValue({
        checkoutUrl: 'https://payos.vn/payment/test-checkout-url',
        orderCode: 123456789,
      });
    } catch (error) {
      console.warn('⚠️ Error cleaning test data:', error.message);
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    }
  });

  async function setupTestData() {
    try {
      // Use dataSource repositories for entities not in PaymentModule
      const spaRepoDS = dataSource.getRepository(Spa);
      const roleRepoDS = dataSource.getRepository(Role);
      const categoryRepoDS = dataSource.getRepository(Category);

      // Create test Spa
      let existingSpa = await spaRepoDS.findOne({ where: {} });
      if (!existingSpa) {
        spa = await spaRepoDS.save({
          name: 'Test Spa',
          address: '123 Test Street',
          phone: '0123456789',
          email: 'test@spa.com',
        });
      } else {
        spa = existingSpa;
      }

      // Create test Role
      let existingRole = await roleRepoDS.findOne({ where: { name: 'staff' } });
      if (!existingRole) {
        role = await roleRepoDS.save({
          name: 'staff',
          description: 'Staff role for testing',
        });
      } else {
        role = existingRole;
      }

      // Create test Customer using repository from module (like cart.integration.spec.ts)
      const customerPassword = '$2b$10$abcdefghijklmnopqrstuv'; // Hardcoded hash for testing
      customer = await customerRepo.save({
        email: 'paymentcustomer@test.com',
        password: customerPassword,
        full_name: 'Payment Test Customer',
        gender: Gender.Male,
        phone: '0123456789',
        refreshToken: '',
        isActive: true,
      });

      // Create test Doctor using repository from module
      const doctorPassword = '$2b$10$abcdefghijklmnopqrstuv';
      doctor = await doctorRepo.save({
        full_name: 'Dr. Payment Test',
        email: 'paymentdoctor@test.com',
        password: doctorPassword,
        specialization: 'General',
        gender: Gender.Male,
        avatar: '',
        biography: 'Test doctor',
        experience_years: 5,
        refreshToken: '',
        isActive: true,
      });

      // Create test Staff using repository from module
      const staffPassword = '$2b$10$abcdefghijklmnopqrstuv';
      staff = await internalRepo.save({
        full_name: 'Staff Payment Test',
        email: 'paymentstaff@test.com',
        password: staffPassword,
        gender: Gender.Male,
        role: role,
        refreshToken: '',
        isActive: true,
      });

      // Create test Category using dataSource repository
      category = await categoryRepoDS.save({
        name: 'Test Category Payment',
        description: 'Category for payment testing',
        isActive: true,
      });

      // Create test Service using repository from module
      service = await serviceRepo.save({
        name: 'Test Service Payment',
        description: 'Service for payment testing',
        price: 200000,
        images: [{ url: 'https://example.com/image1.jpg', alt: 'Test Image' }],
        categoryId: category.id,
        doctors: [doctor],
        isActive: true,
      });
    } catch (error) {
      console.error('❌ Error setting up test data:', error);
      throw error;
    }
  }

  describe('POST /payment/create-link', () => {
    it('should create payment link successfully', async () => {
      // Create appointment first
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      const startTime = new Date(appointmentDate);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);

      appointment = await appointmentRepo.save({
        customerId: customer.id,
        doctorId: doctor.id,
        staffId: staff.id,
        appointment_date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        status: AppointmentStatus.Pending,
        totalAmount: 200000,
        depositAmount: 0,
      });

      appointmentDetail = await appointmentDetailRepo.save({
        appointmentId: appointment.id,
        serviceId: service.id,
        quantity: 1,
        price: 200000,
      });

      const createLinkDto = {
        appointmentId: appointment.id,
        amount: 200000,
        description: 'Payment for appointment',
        returnUrl: 'https://example.com/return',
        cancelUrl: 'https://example.com/cancel',
        customerName: customer.full_name,
      };

      const response = await request(app.getHttpServer())
        .post('/payment/create-link')
        .send(createLinkDto)
        .expect(201);

      expect(response.body).toHaveProperty('checkoutUrl');
      expect(response.body.checkoutUrl).toBe(
        'https://payos.vn/payment/test-checkout-url',
      );
      expect(response.body).toHaveProperty('orderCode');

      // Verify appointment orderCode was updated
      const updatedAppointment = await appointmentRepo.findOne({
        where: { id: appointment.id },
      });
      expect(updatedAppointment).not.toBeNull();
      if (updatedAppointment) {
        expect(updatedAppointment.orderCode).toBeDefined();
        expect(updatedAppointment.orderCode).toBeGreaterThan(0);
      }
    });

    it('should fail when appointment not found', async () => {
      const fakeAppointmentId = '00000000-0000-0000-0000-000000000000';
      const createLinkDto = {
        appointmentId: fakeAppointmentId,
        amount: 200000,
        description: 'Payment for appointment',
        returnUrl: 'https://example.com/return',
        cancelUrl: 'https://example.com/cancel',
        customerName: 'Test Customer',
      };

      await request(app.getHttpServer())
        .post('/payment/create-link')
        .send(createLinkDto)
        .expect(404);
    });

    it('should fail when required fields are missing', async () => {
      const invalidDto = {
        appointmentId: 'some-id',
        // Missing amount, description, returnUrl, cancelUrl
      };

      await request(app.getHttpServer())
        .post('/payment/create-link')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /payment/update-status-deposited', () => {
    beforeEach(async () => {
      // Create confirmed appointment for deposit test
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      const startTime = new Date(appointmentDate);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);

      appointment = await appointmentRepo.save({
        customerId: customer.id,
        doctorId: doctor.id,
        staffId: staff.id,
        appointment_date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        status: AppointmentStatus.Confirmed,
        totalAmount: 200000,
        depositAmount: 0,
        orderCode: Math.floor(Date.now() / 1000),
      });

      appointmentDetail = await appointmentDetailRepo.save({
        appointmentId: appointment.id,
        serviceId: service.id,
        quantity: 1,
        price: 200000,
      });
    });

    it('should update payment status to deposited successfully', async () => {
      const updateDto = {
        orderCode: appointment.orderCode?.toString() || '',
      };

      const response = await request(app.getHttpServer())
        .post('/payment/update-status-deposited')
        .send(updateDto)
        .expect(201);

      // Verify appointment status was updated
      const updatedAppointment = await appointmentRepo.findOne({
        where: { id: appointment.id },
        relations: ['details', 'details.service'],
      });

      expect(updatedAppointment).not.toBeNull();
      if (updatedAppointment) {
        expect(updatedAppointment.status).toBe('deposited');
        expect(updatedAppointment.depositAmount).toBeGreaterThan(0);
        expect(updatedAppointment.depositAmount).toBe(100000); // 50% of 200000
      }
    });

    it('should fail when appointment not found', async () => {
      const updateDto = {
        orderCode: '999999999',
      };

      await request(app.getHttpServer())
        .post('/payment/update-status-deposited')
        .send(updateDto)
        .expect(404);
    });

    it('should fail when appointment status is not Confirmed', async () => {
      // Update appointment to Pending status
      await appointmentRepo.update(appointment.id, {
        status: AppointmentStatus.Pending,
      });

      const updateDto = {
        orderCode: appointment.orderCode?.toString() || '',
      };

      await request(app.getHttpServer())
        .post('/payment/update-status-deposited')
        .send(updateDto)
        .expect(400);
    });

    it('should fail when required fields are missing', async () => {
      const invalidDto = {
        // Missing orderCode
      };

      await request(app.getHttpServer())
        .post('/payment/update-status-deposited')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('POST /payment/update-status-paid', () => {
    beforeEach(async () => {
      // Create completed appointment for paid test
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() - 1); // Past date
      const startTime = new Date(appointmentDate);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);

      appointment = await appointmentRepo.save({
        customerId: customer.id,
        doctorId: doctor.id,
        staffId: staff.id,
        appointment_date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        status: AppointmentStatus.Completed,
        totalAmount: 200000,
        depositAmount: 100000,
        orderCode: Math.floor(Date.now() / 1000),
      });

      appointmentDetail = await appointmentDetailRepo.save({
        appointmentId: appointment.id,
        serviceId: service.id,
        quantity: 1,
        price: 200000,
      });
    });

    it('should update payment status to paid successfully', async () => {
      const updateDto = {
        orderCode: appointment.orderCode?.toString() || '',
      };

      const response = await request(app.getHttpServer())
        .post('/payment/update-status-paid')
        .send(updateDto)
        .expect(201);

      // Verify appointment status was updated
      const updatedAppointment = await appointmentRepo.findOne({
        where: { id: appointment.id },
      });

      expect(updatedAppointment).not.toBeNull();
      if (updatedAppointment) {
        expect(updatedAppointment.status).toBe('paid');
        expect(updatedAppointment.paymentMethod).toBe('qr');
      }
    });

    it('should fail when appointment not found', async () => {
      const updateDto = {
        orderCode: '999999999',
      };

      await request(app.getHttpServer())
        .post('/payment/update-status-paid')
        .send(updateDto)
        .expect(404);
    });

    it('should fail when appointment status is not Completed', async () => {
      // Update appointment to Confirmed status
      await appointmentRepo.update(appointment.id, {
        status: AppointmentStatus.Confirmed,
      });

      const updateDto = {
        orderCode: appointment.orderCode?.toString() || '',
      };

      await request(app.getHttpServer())
        .post('/payment/update-status-paid')
        .send(updateDto)
        .expect(400);
    });

    it('should fail when required fields are missing', async () => {
      const invalidDto = {
        // Missing orderCode
      };

      await request(app.getHttpServer())
        .post('/payment/update-status-paid')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('Payment Flow Integration', () => {
    it('should complete full payment flow: create link -> deposit -> paid', async () => {
      // Step 1: Create appointment
      const appointmentDate = new Date();
      appointmentDate.setDate(appointmentDate.getDate() + 1);
      const startTime = new Date(appointmentDate);
      startTime.setHours(10, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(11, 0, 0, 0);

      const newAppointment = await appointmentRepo.save({
        customerId: customer.id,
        doctorId: doctor.id,
        staffId: staff.id,
        appointment_date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        status: AppointmentStatus.Pending,
        totalAmount: 200000,
        depositAmount: 0,
      });

      await appointmentDetailRepo.save({
        appointmentId: newAppointment.id,
        serviceId: service.id,
        quantity: 1,
        price: 200000,
      });

      // Step 2: Create payment link
      const createLinkDto = {
        appointmentId: newAppointment.id,
        amount: 200000,
        description: 'Payment for appointment',
        returnUrl: 'https://example.com/return',
        cancelUrl: 'https://example.com/cancel',
        customerName: customer.full_name,
      };

      const linkResponse = await request(app.getHttpServer())
        .post('/payment/create-link')
        .send(createLinkDto)
        .expect(201);

      expect(linkResponse.body).toHaveProperty('checkoutUrl');

      // Step 3: Update to confirmed status (simulate admin confirmation)
      await appointmentRepo.update(newAppointment.id, {
        status: AppointmentStatus.Confirmed,
      });

      // Step 4: Update to deposited status
      const updatedAppointment = await appointmentRepo.findOne({
        where: { id: newAppointment.id },
      });

      if (updatedAppointment && updatedAppointment.orderCode) {
        const depositDto = {
          orderCode: updatedAppointment.orderCode.toString(),
        };

        await request(app.getHttpServer())
          .post('/payment/update-status-deposited')
          .send(depositDto)
          .expect(201);

        // Step 5: Update to completed status (simulate service completion)
        await appointmentRepo.update(newAppointment.id, {
          status: AppointmentStatus.Completed,
        });

        // Step 6: Update to paid status
        await request(app.getHttpServer())
          .post('/payment/update-status-paid')
          .send(depositDto)
          .expect(200);

        // Verify final state
        const finalAppointment = await appointmentRepo.findOne({
          where: { id: newAppointment.id },
        });

        expect(finalAppointment).not.toBeNull();
        if (finalAppointment) {
          expect(finalAppointment.status).toBe(AppointmentStatus.Paid);
          expect(finalAppointment.paymentMethod).toBe('qr');
          expect(finalAppointment.depositAmount).toBeGreaterThan(0);
        }
      }
    });
  });
});

