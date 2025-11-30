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

describe('FeedbackController (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let customer: Customer;
  let doctor: Doctor;
  let category: Category;
  let service: Service;
  let appointment: Appointment;
  let appointmentDetail: AppointmentDetail;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306'),
          username: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || 'root',
          database: process.env.DB_DATABASE || 'gen_spa',
          entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
          synchronize: false,
          dropSchema: false,
        }),
        FeedbackModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('DELETE FROM `feedback`');
    await dataSource.query('DELETE FROM `appointment_detail`');
    await dataSource.query('DELETE FROM `appointment`');
    await dataSource.query('DELETE FROM `service`');
    await dataSource.query('DELETE FROM `customer`');
    await dataSource.query('DELETE FROM `doctor`');
    await dataSource.query('DELETE FROM `category`');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
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
      price: 100000,
      images: [],
      isActive: true,
      categoryId: category.id,
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
      service_price: 100000,
    });
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
        .send(createDtos)
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

    it('should return all feedbacks', async () => {
      const response = await request(app.getHttpServer())
        .get('/feedback')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/feedback?status=PENDING')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(FeedbackStatus.Pending);
    });
  });

  describe('GET /feedback/:id', () => {
    it('should return a feedback by id', async () => {
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
      expect(response.body.rating).toBe(5);
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

  describe('GET /feedback/appointment-detail/:id', () => {
    it('should get feedbacks by appointment detail', async () => {
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
        .get(`/feedback/appointment-detail/${appointmentDetail.id}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].rating).toBe(5);
    });
  });

  describe('GET /feedback/customer/:id', () => {
    it('should get feedbacks by customer', async () => {
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
      expect(response.body[0].appointmentId).toBe(appointment.id);
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
