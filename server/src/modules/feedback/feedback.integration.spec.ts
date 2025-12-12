import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { FeedbackModule } from './feedback.module';
import { Feedback } from '@/entities/feedback.entity';
import { Customer } from '@/entities/customer.entity';
import { Appointment } from '@/entities/appointment.entity';
import { AppointmentDetail } from '@/entities/appointmentDetails.entity';
import { Service } from '@/entities/service.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Category } from '@/entities/category.entity';
import { FeedbackStatus } from '@/entities/enums/feedback-status';
import { AppointmentStatus } from '@/entities/enums/appointment-status';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

describe('FeedbackController (Integration)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let customer: Customer;
  let doctor: Doctor;
  let category: Category;
  let service: Service;
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
        FeedbackModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60000);

  afterAll(async () => {
    try {
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      await dataSource.query('DELETE FROM `feedback`');
      await dataSource.query('DELETE FROM `appointment_detail`');
      await dataSource.query('DELETE FROM `appointment`');
      await dataSource.query('DELETE FROM `service`');
      await dataSource.query('DELETE FROM `customer`');
      await dataSource.query('DELETE FROM `doctor`');
      await dataSource.query('DELETE FROM `category`');
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
      
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
        console.log('✅ Test database connection closed');
      }
      if (app) {
        await app.close();
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }, 30000);

  beforeEach(async () => {
    try {
      // Clean database
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      await dataSource.query('TRUNCATE TABLE `feedback`');
      await dataSource.query('TRUNCATE TABLE `appointment_detail`');
      await dataSource.query('TRUNCATE TABLE `appointment`');
      await dataSource.query('TRUNCATE TABLE `service`');
      await dataSource.query('TRUNCATE TABLE `customer`');
      await dataSource.query('TRUNCATE TABLE `doctor`');
      await dataSource.query('TRUNCATE TABLE `category`');
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

      // Create test data
      const categoryRepo = dataSource.getRepository(Category);
      category = await categoryRepo.save({
        name: 'Test Category',
        description: 'Category for testing',
        isActive: true,
      });

      const customerRepo = dataSource.getRepository(Customer);
      customer = await customerRepo.save({
        email: 'customer@test.com',
        full_name: 'Test Customer',
        password: 'hashedPassword',
      });

      const doctorRepo = dataSource.getRepository(Doctor);
      doctor = await doctorRepo.save({
        email: 'doctor@test.com',
        full_name: 'Test Doctor',
        password: 'hashedPassword',
        specialization: 'General',
      });

      const serviceRepo = dataSource.getRepository(Service);
      service = await serviceRepo.save({
        name: 'Test Service',
        description: 'Test Description',
        images: [{ url: 'https://example.com/image.jpg', alt: 'Test Image' }],
        categoryId: category.id,
        price: 100000,
        isActive: true,
      });

      const appointmentRepo = dataSource.getRepository(Appointment);
      appointment = await appointmentRepo.save({
        customerId: customer.id,
        doctorId: doctor.id,
        appointment_date: new Date(),
        startTime: new Date(),
        endTime: new Date(),
        status: AppointmentStatus.Confirmed,
      });

      const detailRepo = dataSource.getRepository(AppointmentDetail);
      appointmentDetail = await detailRepo.save({
        appointmentId: appointment.id,
        serviceId: service.id,
        quantity: 1,
        price: 100000,
      });
    } catch (error) {
      console.error('❌ Error in beforeEach setup:', error);
      throw error;
    }
  });

  describe('POST /feedback', () => {
    it('should create a new feedback', async () => {
      const createDto = {
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Excellent service!',
      };

      const response = await request(app.getHttpServer())
        .post('/feedback')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        customerId: customer.id,
        appointmentId: appointment.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Excellent service!',
        status: FeedbackStatus.Pending,
      });
      expect(response.body.id).toBeDefined();
    });
  });

  describe('POST /feedback/bulk', () => {
    it('should create multiple feedbacks', async () => {
      const createDtos = [
        {
          customerId: customer.id,
          appointmentId: appointment.id,
          appointmentDetailId: appointmentDetail.id,
          serviceId: service.id,
          rating: 5,
          comment: 'Great!',
        },
        {
          customerId: customer.id,
          appointmentId: appointment.id,
          appointmentDetailId: appointmentDetail.id,
          serviceId: service.id,
          rating: 4,
          comment: 'Good!',
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/feedback/bulk')
        .send({ feedbacks: createDtos })
        .expect(201);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].rating).toBe(5);
      expect(response.body[1].rating).toBe(4);
    });
  });

  describe('GET /feedback', () => {
    beforeEach(async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });
      await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 4,
        comment: 'Good',
        status: FeedbackStatus.Approved,
      });
    });

    it('should return all feedbacks with relations', async () => {
      const response = await request(app.getHttpServer())
        .get('/feedback')
        .expect(200);

      const feedbacks = Array.isArray(response.body) ? response.body : response.body.data;
      expect(feedbacks).toHaveLength(2);
      expect(feedbacks[0].customer).toBeDefined();
      expect(feedbacks[0].appointmentDetail).toBeDefined();
    });
  });

  describe('GET /feedback/:id', () => {
    it('should return a feedback by id with relations', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      const response = await request(app.getHttpServer())
        .get(`/feedback/${feedback.id}`)
        .expect(200);

      expect(response.body.id).toBe(feedback.id);
      expect(Number(response.body.rating)).toBe(5);
      expect(response.body.customer).toBeDefined();
      expect(response.body.customer.id).toBe(customer.id);
      expect(response.body.appointmentDetail).toBeDefined();
    });

    it('should return 404 for non-existent feedback', async () => {
      await request(app.getHttpServer())
        .get('/feedback/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /feedback/:id', () => {
    it('should update a feedback', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      const updateDto = {
        rating: 4,
        comment: 'Updated comment',
      };

      const response = await request(app.getHttpServer())
        .patch(`/feedback/${feedback.id}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.rating).toBe(4);
      expect(response.body.comment).toBe('Updated comment');
    });
  });

  describe('DELETE /feedback/:id', () => {
    it('should delete a feedback', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      await request(app.getHttpServer())
        .delete(`/feedback/${feedback.id}`)
        .expect(200);

      const deleted = await feedbackRepo.findOne({ where: { id: feedback.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('GET /feedback/customer/:id', () => {
    it('should get feedbacks by customer with appointmentDetail relation', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      const response = await request(app.getHttpServer())
        .get(`/feedback/customer/${customer.id}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].customerId).toBe(customer.id);
      expect(response.body[0].appointmentDetail).toBeDefined();
    });
  });

  describe('GET /feedback/appointment/:id', () => {
    it('should get feedbacks by appointment', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      const response = await request(app.getHttpServer())
        .get(`/feedback/appointment/${appointment.id}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(Number(response.body[0].rating)).toBe(5);
      expect(response.body[0].comment).toBe('Great!');
    });
  });

  describe('PATCH /feedback/:id/approve', () => {
    it('should approve a feedback', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      const response = await request(app.getHttpServer())
        .patch(`/feedback/${feedback.id}/approve`)
        .expect(200);

      expect(response.body.status).toBe(FeedbackStatus.Approved);
    });
  });

  describe('PATCH /feedback/:id/reject', () => {
    it('should reject a feedback', async () => {
      const feedbackRepo = dataSource.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        customerId: customer.id,
        appointmentId: appointment.id,
        appointmentDetailId: appointmentDetail.id,
        serviceId: service.id,
        rating: 5,
        comment: 'Great!',
        status: FeedbackStatus.Pending,
      });

      const response = await request(app.getHttpServer())
        .patch(`/feedback/${feedback.id}/reject`)
        .expect(200);

      expect(response.body.status).toBe(FeedbackStatus.Rejected);
    });
  });
});
