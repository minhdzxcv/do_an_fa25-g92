import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VoucherModule } from './voucher.module';
import { Voucher } from '@/entities/voucher.entity';
import { Customer } from '@/entities/customer.entity';
import { CustomerVoucher } from '@/entities/customerVoucher.entity';
import { Spa } from '@/entities/spa.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';

describe('VoucherController (Integration)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let customer1: Customer;
  let customer2: Customer;
  let spa: Spa;

  // Mock MailService
  const mockMailService = {
    sendVoucherEmail: jest.fn().mockResolvedValue(true),
  };

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
        VoucherModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 60000);

  afterAll(async () => {
    try {
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      await dataSource.query('DELETE FROM `customer_voucher`');
      await dataSource.query('DELETE FROM `voucher`');
      await dataSource.query('DELETE FROM `customer`');
      await dataSource.query('DELETE FROM `spa`');
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
      await dataSource.query('TRUNCATE TABLE `customer_voucher`');
      await dataSource.query('TRUNCATE TABLE `voucher`');
      await dataSource.query('TRUNCATE TABLE `customer`');
      await dataSource.query('TRUNCATE TABLE `spa`');
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');

      // Reset mock
      mockMailService.sendVoucherEmail.mockClear();

      // Create single spa record (required by service)
      const spaRepo = dataSource.getRepository(Spa);
      spa = await spaRepo.save({
        name: 'GenSpa Test',
        phone: '0384542297',
        address: 'Test Address',
        email: 'test@genspa.com',
      });

      // Create test customers
      const customerRepo = dataSource.getRepository(Customer);
      customer1 = await customerRepo.save({
        email: 'customer1@test.com',
        full_name: 'Test Customer 1',
        password: 'hashedPassword',
      });

      customer2 = await customerRepo.save({
        email: 'customer2@test.com',
        full_name: 'Test Customer 2',
        password: 'hashedPassword',
      });
    } catch (error) {
      console.error('❌ Error in beforeEach setup:', error);
      throw error;
    }
  });

  describe('POST /voucher', () => {
    it('should create a voucher without customers', async () => {
      const createDto = {
        code: 'DISCOUNT50',
        description: 'Discount 50k',
        discountAmount: 50000,
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/voucher')
        .send(createDto)
        .expect(201);

      expect(response.body.code).toBe('DISCOUNT50');
      expect(response.body.description).toBe('Discount 50k');
      expect(Number(response.body.discountAmount)).toBe(50000);
      expect(response.body.isActive).toBe(true);
      expect(response.body.id).toBeDefined();
      expect(mockMailService.sendVoucherEmail).not.toHaveBeenCalled();
    });

    it('should create voucher and send emails to customers', async () => {
      const createDto = {
        code: 'SUMMER2025',
        description: 'Summer discount',
        discountPercent: 20,
        maxDiscount: 100000,
        customerIds: [customer1.id, customer2.id],
      };

      const response = await request(app.getHttpServer())
        .post('/voucher')
        .send(createDto)
        .expect(201);

      expect(response.body.code).toBe('SUMMER2025');
      expect(mockMailService.sendVoucherEmail).toHaveBeenCalledTimes(2);

      // Verify customer-voucher relationship created
      const cvRepo = dataSource.getRepository(CustomerVoucher);
      const customerVouchers = await cvRepo.find({
        where: { voucherId: response.body.id },
      });
      expect(customerVouchers).toHaveLength(2);
    });

    it('should return 400 for duplicate voucher code', async () => {
      const createDto = {
        code: 'DUPLICATE',
        description: 'Test',
        discountAmount: 10000,
      };

      await request(app.getHttpServer()).post('/voucher').send(createDto).expect(201);

      await request(app.getHttpServer()).post('/voucher').send(createDto).expect(400);
    });
  });

  describe('GET /voucher', () => {
    it('should return all active vouchers', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      await voucherRepo.save({
        code: 'VOUCHER1',
        description: 'Test 1',
        discountAmount: 10000,
      });
      await voucherRepo.save({
        code: 'VOUCHER2',
        description: 'Test 2',
        discountPercent: 15,
      });

      const response = await request(app.getHttpServer()).get('/voucher').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].code).toBeDefined();
    });

    it('should return empty array when no vouchers', async () => {
      const response = await request(app.getHttpServer()).get('/voucher').expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /voucher/:id', () => {
    it('should return voucher by id with customerIds', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      const voucher = await voucherRepo.save({
        code: 'TEST123',
        description: 'Test voucher',
        discountAmount: 25000,
      });

      const cvRepo = dataSource.getRepository(CustomerVoucher);
      await cvRepo.save({
        customerId: customer1.id,
        voucherId: voucher.id,
      });

      const response = await request(app.getHttpServer())
        .get(`/voucher/${voucher.id}`)
        .expect(200);

      expect(response.body.id).toBe(voucher.id);
      expect(response.body.code).toBe('TEST123');
      expect(response.body.customerIds).toBeDefined();
      expect(response.body.customerIds).toHaveLength(1);
      expect(response.body.customerIds[0]).toBe(customer1.id);
    });

    it('should return 404 for non-existent voucher', async () => {
      await request(app.getHttpServer())
        .get('/voucher/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /voucher/:id', () => {
    it('should update voucher fields', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      const voucher = await voucherRepo.save({
        code: 'UPDATE123',
        description: 'Original',
        discountAmount: 10000,
      });

      const updateDto = {
        description: 'Updated description',
        discountAmount: 20000,
      };

      const response = await request(app.getHttpServer())
        .patch(`/voucher/${voucher.id}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.description).toBe('Updated description');
      expect(Number(response.body.discountAmount)).toBe(20000);
      expect(response.body.code).toBe('UPDATE123');
    });

    it('should update customer assignments and send emails to new customers', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      const voucher = await voucherRepo.save({
        code: 'ASSIGN123',
        description: 'Test',
        discountAmount: 15000,
      });

      // Initially assign to customer1
      const cvRepo = dataSource.getRepository(CustomerVoucher);
      await cvRepo.save({
        customerId: customer1.id,
        voucherId: voucher.id,
      });

      mockMailService.sendVoucherEmail.mockClear();

      // Update to include customer2 (new)
      const updateDto = {
        customerIds: [customer1.id, customer2.id],
      };

      await request(app.getHttpServer())
        .patch(`/voucher/${voucher.id}`)
        .send(updateDto)
        .expect(200);

      // Email should be sent only to new customer (customer2)
      expect(mockMailService.sendVoucherEmail).toHaveBeenCalledTimes(1);

      // Verify both customers now have the voucher
      const customerVouchers = await cvRepo.find({ where: { voucherId: voucher.id } });
      expect(customerVouchers).toHaveLength(2);
    });
  });

  describe('DELETE /voucher/:id', () => {
    it('should soft delete voucher', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      const voucher = await voucherRepo.save({
        code: 'DELETE123',
        description: 'To be deleted',
        discountAmount: 5000,
      });

      await request(app.getHttpServer()).delete(`/voucher/${voucher.id}`).expect(200);

      // Verify soft deleted
      const deleted = await voucherRepo.findOne({ where: { id: voucher.id } });
      expect(deleted).toBeNull();

      // Verify can still find with withDeleted
      const softDeleted = await voucherRepo.findOne({
        where: { id: voucher.id },
        withDeleted: true,
      });
      expect(softDeleted).toBeDefined();
      expect(softDeleted?.deletedAt).toBeDefined();
    });
  });

  describe('GET /voucher/customers/:customerId', () => {
    it('should return available vouchers for customer', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      const voucher1 = await voucherRepo.save({
        code: 'CUST1',
        description: 'For customer',
        discountAmount: 10000,
      });
      const voucher2 = await voucherRepo.save({
        code: 'CUST2',
        description: 'Another voucher',
        discountPercent: 10,
      });

      const cvRepo = dataSource.getRepository(CustomerVoucher);
      await cvRepo.save({
        customerId: customer1.id,
        voucherId: voucher1.id,
        isUsed: false,
      });
      await cvRepo.save({
        customerId: customer1.id,
        voucherId: voucher2.id,
        isUsed: false,
      });

      const response = await request(app.getHttpServer())
        .get(`/voucher/customers/${customer1.id}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.map((v) => v.code)).toContain('CUST1');
      expect(response.body.map((v) => v.code)).toContain('CUST2');
    });

    it('should not return used vouchers', async () => {
      const voucherRepo = dataSource.getRepository(Voucher);
      const voucher = await voucherRepo.save({
        code: 'USED123',
        description: 'Used voucher',
        discountAmount: 10000,
      });

      const cvRepo = dataSource.getRepository(CustomerVoucher);
      await cvRepo.save({
        customerId: customer1.id,
        voucherId: voucher.id,
        isUsed: true,
        usedAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .get(`/voucher/customers/${customer1.id}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return empty array when customer has no vouchers', async () => {
      const response = await request(app.getHttpServer())
        .get(`/voucher/customers/${customer1.id}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
