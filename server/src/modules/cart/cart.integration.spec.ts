import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { CartModule } from './cart.module';
import { Cart } from '@/entities/cart.entity';
import { CartDetail } from '@/entities/cartDetails.entity';
import { Customer } from '@/entities/customer.entity';
import { Service } from '@/entities/service.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Category } from '@/entities/category.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Gender } from '@/entities/enums/gender.enum';
import { hashPassword } from '@/common/utils/security';

describe('Cart Module Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;

  let cartRepo: Repository<Cart>;
  let cartDetailRepo: Repository<CartDetail>;
  let customerRepo: Repository<Customer>;
  let serviceRepo: Repository<Service>;
  let doctorRepo: Repository<Doctor>;
  let categoryRepo: Repository<Category>;

  // Test data
  let customer: Customer;
  let doctor: Doctor;
  let category: Category;
  let service: Service;

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
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
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
        CartModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    cartRepo = moduleFixture.get<Repository<Cart>>(getRepositoryToken(Cart));
    cartDetailRepo = moduleFixture.get<Repository<CartDetail>>(
      getRepositoryToken(CartDetail),
    );
    customerRepo = moduleFixture.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    serviceRepo = moduleFixture.get<Repository<Service>>(getRepositoryToken(Service));
    doctorRepo = moduleFixture.get<Repository<Doctor>>(getRepositoryToken(Doctor));
    categoryRepo = moduleFixture.get<Repository<Category>>(
      getRepositoryToken(Category),
    );

    // Create test Customer with all required fields
    const hashedPassword = await hashPassword('password123');
    customer = await customerRepo.save({
      email: 'cartcustomer@test.com',
      password: hashedPassword,
      full_name: 'Test Customer',
      gender: Gender.Male,
      phone: '0123456789',
      refreshToken: '',
      isActive: true,
    });

    // Create test Doctor with all required fields
    const doctorPassword = await hashPassword('password123');
    doctor = await doctorRepo.save({
      full_name: 'Dr. Test',
      email: 'cartdoctor@test.com',
      password: doctorPassword,
      specialization: 'General',
      gender: Gender.Male,
      avatar: '',
      biography: 'Test doctor',
      experience_years: 5,
      refreshToken: '',
      isActive: true,
    });

    // Create test Category
    category = await categoryRepo.save({
      name: 'Test Category Cart',
      description: 'Category for testing',
      isActive: true,
    });

    // Create test Service with doctor relationship
    service = await serviceRepo.save({
      name: 'Test Service Cart',
      description: 'Service for testing',
      price: 100,
      images: [{ url: 'https://example.com/image1.jpg', alt: 'Test Image' }],
      categoryId: category.id,
      doctors: [doctor], // Assign doctor
      isActive: true,
    });
  }, 60000);

  afterAll(async () => {
    try {
      // Cleanup in correct order to avoid foreign key constraints
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
        await dataSource.query('DELETE FROM cart_detail');
        await dataSource.query('DELETE FROM cart');
        await dataSource.query('DELETE FROM service');
        await dataSource.query('DELETE FROM doctor');
        await dataSource.query('DELETE FROM category');
        await dataSource.query('DELETE FROM customer');
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
      // Re-enable foreign key checks in case of error
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    }
  }, 30000);

  beforeEach(async () => {
    // Clean cart data before each test to ensure test isolation
    try {
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
        await dataSource.query('DELETE FROM cart_detail');
        await dataSource.query('DELETE FROM cart');
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning test data:', error.message);
      if (dataSource && dataSource.isInitialized) {
        await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      }
    }
  });

  describe('GET /cart/:id', () => {
    it('should create cart if not exist', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cart/${customer.id}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.items).toEqual([]);
    });
  });

  describe('POST /cart/add/:id', () => {
    it('should add item to cart', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: service.id, quantity: 2, doctorId: doctor.id })
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items[0].id).toBe(service.id);
      expect(res.body.items[0].quantity).toBe(2);
    });

    it('should fail if adding same service with same doctor again', async () => {
      // First add item
      await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: service.id, quantity: 1, doctorId: doctor.id })
        .expect(200);

      // Try to add same item again
      await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: service.id, quantity: 1, doctorId: doctor.id })
        .expect(400);
    });

    it('should fail if doctor not allowed', async () => {
      const fakeDoctorId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: service.id, quantity: 1, doctorId: fakeDoctorId })
        .expect(400);
    });

    it('should fail if service not found', async () => {
      const fakeServiceId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: fakeServiceId, quantity: 1, doctorId: doctor.id })
        .expect(404);
    });
  });

  describe('DELETE /cart/:id/items/:itemId', () => {
    it('should remove item from cart', async () => {
      // First add item
      await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: service.id, quantity: 1, doctorId: doctor.id })
        .expect(200);

      // Then remove it
      const res = await request(app.getHttpServer())
        .delete(`/cart/${customer.id}/items/${service.id}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should fail if item does not exist', async () => {
      await request(app.getHttpServer())
        .delete(`/cart/${customer.id}/items/${service.id}`)
        .expect(400);
    });

    it('should fail if cart does not exist', async () => {
      const fakeCustomerId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .delete(`/cart/${fakeCustomerId}/items/${service.id}`)
        .expect(404);
    });
  });

  describe('POST /cart/clear/:id', () => {
    it('should clear all items in cart', async () => {
      // Add items first
      await request(app.getHttpServer())
        .post(`/cart/add/${customer.id}`)
        .send({ itemId: service.id, quantity: 1, doctorId: doctor.id })
        .expect(200);

      // Clear cart
      const res = await request(app.getHttpServer())
        .post(`/cart/clear/${customer.id}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBe(0);
    });

    it('should handle clearing empty cart', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cart/clear/${customer.id}`)
        .expect(200);

      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should fail if cart does not exist', async () => {
      const fakeCustomerId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .post(`/cart/clear/${fakeCustomerId}`)
        .expect(404);
    });
  });
});
