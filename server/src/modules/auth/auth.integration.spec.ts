import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { AuthService } from './auth.service';
import { Customer } from '@/entities/customer.entity';
import { Internal } from '@/entities/internal.entity';
import { Doctor } from '@/entities/doctor.entity';
import { Role } from '@/entities/role.entity';
import { Gender } from '@/entities/enums/gender.enum';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { hashPassword } from '@/common/utils/security';

describe('Auth Module Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let customerRepository: Repository<Customer>;
  let internalRepository: Repository<Internal>;
  let doctorRepository: Repository<Doctor>;
  let roleRepository: Repository<Role>;
  let authService: AuthService;

  // Test data
  let createdCustomerId: string;
  let createdRoleId: number;
  let testCustomerEmail: string;
  let testCustomerPassword: string;

  beforeAll(async () => {
    // Setup test database connection - use real database from .env
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT || '3306');
    const dbUsername = process.env.DB_USERNAME || 'root';
    const dbPassword = process.env.DB_PASSWORD || 'root';
    const dbName = process.env.DB_DATABASE || 'gen_spa';

    // Create test data source - connect to real database
    dataSource = new DataSource({
      type: 'mysql',
      host: dbHost,
      port: dbPort,
      username: dbUsername,
      password: dbPassword,
      database: dbName,
      entities: [__dirname + '/../../entities/*.entity.{js,ts}'],
      synchronize: false, // Don't sync, use existing schema
      logging: false,
    });

    try {
      await dataSource.initialize();
      console.log(`✅ Connected to database: ${dbName}`);
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }

    // Create test module with TypeORM
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
          synchronize: false, // Don't sync, use existing schema
          logging: false,
        }),
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET || 'test-secret-key-12345',
          signOptions: { expiresIn: '1d' },
        }),
        MailModule,
        AuthModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue({
        sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
        confirmAppointment: jest.fn().mockResolvedValue(undefined),
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

    // Get repositories
    customerRepository = moduleFixture.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
    internalRepository = moduleFixture.get<Repository<Internal>>(
      getRepositoryToken(Internal),
    );
    doctorRepository = moduleFixture.get<Repository<Doctor>>(
      getRepositoryToken(Doctor),
    );
    roleRepository = moduleFixture.get<Repository<Role>>(
      getRepositoryToken(Role),
    );
    authService = moduleFixture.get<AuthService>(AuthService);

    // Setup test data
    await setupTestData();
  }, 60000);

  afterAll(async () => {
    // Cleanup
    try {
      await cleanupTestData();
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
    // Clean database before each test
    try {
      // Only delete test data created during tests, not all data
      // Use SQL to delete test customers by email pattern or createdCustomerId
      if (createdCustomerId) {
        await customerRepository.delete({ id: createdCustomerId });
      }
      // Delete test customers by email pattern if needed
      await dataSource.query(
        "DELETE FROM customer WHERE email LIKE 'test%' OR email LIKE 'newcustomer%' OR email LIKE 'duplicate%'",
      );
      // Keep roles, internals, and doctors as they're needed for setup
    } catch (error) {
      console.warn('⚠️ Error cleaning test data:', error);
    }
  });

  async function setupTestData() {
    try {
      // Create test role if it doesn't exist
      let role = await roleRepository.findOne({ where: { name: 'staff' } });
      if (!role) {
        role = roleRepository.create({
          name: 'staff',
          description: 'Staff role for testing',
        });
        role = await roleRepository.save(role);
      }
      createdRoleId = role.id;

      // Setup test customer credentials
      testCustomerEmail = 'testcustomer@example.com';
      testCustomerPassword = 'password123';
    } catch (error) {
      console.error('❌ Error setting up test data:', error);
      throw error;
    }
  }

  async function cleanupTestData() {
    try {
      // Use SQL queries to delete data to avoid foreign key constraints
      if (dataSource && dataSource.isInitialized) {
        try {
          // Disable foreign key checks temporarily
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
          // Delete test data in correct order
          await dataSource.query('DELETE FROM customer');
          await dataSource.query('DELETE FROM internal');
          await dataSource.query('DELETE FROM doctor');
          await dataSource.query('DELETE FROM role');
          // Re-enable foreign key checks
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (error) {
          // Re-enable foreign key checks in case of error
          await dataSource.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up test data:', error);
    }
  }

  describe('Customer Registration', () => {
    describe('POST /auth/register-customer', () => {
      it('should register a new customer successfully', async () => {
        const registerDto = {
          full_name: 'Test Customer',
          email: 'newcustomer@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
          birth_date: '1990-01-01',
        };

        const response = await request(app.getHttpServer())
          .post('/auth/register-customer')
          .send(registerDto)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.email).toBe(registerDto.email);
        expect(response.body.full_name).toBe(registerDto.full_name);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('refreshToken');

        createdCustomerId = response.body.id;
      });

      it('should fail when email already exists', async () => {
        const registerDto = {
          full_name: 'Test Customer',
          email: 'duplicate@example.com',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
        };

        // Register first customer
        await request(app.getHttpServer())
          .post('/auth/register-customer')
          .send(registerDto)
          .expect(201);

        // Try to register duplicate
        await request(app.getHttpServer())
          .post('/auth/register-customer')
          .send(registerDto)
          .expect(409);
      });

      it('should fail when required fields are missing', async () => {
        const invalidDto = {
          full_name: 'Test Customer',
          // Missing email, password, phone
        };

        await request(app.getHttpServer())
          .post('/auth/register-customer')
          .send(invalidDto)
          .expect(400);
      });

      it('should fail when email format is invalid', async () => {
        const invalidDto = {
          full_name: 'Test Customer',
          email: 'invalid-email',
          password: 'password123',
          phone: '0123456789',
          gender: Gender.Male,
        };

        await request(app.getHttpServer())
          .post('/auth/register-customer')
          .send(invalidDto)
          .expect(400);
      });
    });
  });

  describe('Customer Login', () => {
    beforeEach(async () => {
      // Create a test customer for login tests
      const hashedPassword = await hashPassword(testCustomerPassword);
      const customer = customerRepository.create({
        full_name: 'Test Customer',
        email: testCustomerEmail,
        password: hashedPassword,
        phone: '0123456789',
        gender: Gender.Male,
        isActive: true,
        refreshToken: '',
      });
      const savedCustomer = await customerRepository.save(customer);
      createdCustomerId = savedCustomer.id;
    });

    describe('POST /auth/login', () => {
      it('should login customer successfully', async () => {
        const loginDto = {
          email: testCustomerEmail,
          password: testCustomerPassword,
        };

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body.email).toBe(testCustomerEmail);
        expect(response.body.role).toBe('Customer');
        expect(response.body).not.toHaveProperty('password');
      });

      it('should fail with wrong password', async () => {
        const loginDto = {
          email: testCustomerEmail,
          password: 'wrongpassword',
        };

        await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(401);
      });

      it('should fail with non-existent email', async () => {
        const loginDto = {
          email: 'nonexistent@example.com',
          password: 'password123',
        };

        await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(401);
      });

      it('should fail when customer is inactive', async () => {
        // Create inactive customer
        const hashedPassword = await hashPassword(testCustomerPassword);
        const inactiveCustomer = customerRepository.create({
          full_name: 'Inactive Customer',
          email: 'inactive@example.com',
          password: hashedPassword,
          phone: '0123456789',
          gender: Gender.Male,
          isActive: false,
          refreshToken: '',
        });
        await customerRepository.save(inactiveCustomer);

        const loginDto = {
          email: 'inactive@example.com',
          password: testCustomerPassword,
        };

        await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(401);
      });
    });

    describe('POST /auth/refresh-token', () => {
      it('should refresh token successfully', async () => {
        // First login to get refresh token
        const loginDto = {
          email: testCustomerEmail,
          password: testCustomerPassword,
        };

        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(200);

        const refreshTokenValue = loginResponse.body.refreshToken;

        // Refresh token
        const response = await request(app.getHttpServer())
          .post('/auth/refresh-token')
          .send({ refresh_token: refreshTokenValue })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body.accessToken).not.toBe(loginResponse.body.accessToken);
      });

      it('should fail with invalid refresh token', async () => {
        await request(app.getHttpServer())
          .post('/auth/refresh-token')
          .send({ refresh_token: 'invalid-token' })
          .expect(400);
      });
    });
  });

  describe('Customer Profile Management', () => {
    beforeEach(async () => {
      // Create a test customer for profile tests
      const hashedPassword = await hashPassword(testCustomerPassword);
      const customer = customerRepository.create({
        full_name: 'Test Customer',
        email: 'profilecustomer@example.com',
        password: hashedPassword,
        phone: '0123456789',
        gender: Gender.Male,
        isActive: true,
        refreshToken: '',
      });
      const savedCustomer = await customerRepository.save(customer);
      createdCustomerId = savedCustomer.id;
    });

    describe('GET /auth/profile/:id', () => {
      it('should get customer profile successfully', async () => {
        const response = await request(app.getHttpServer())
          .get(`/auth/profile/${createdCustomerId}`)
          .expect(200);

        expect(response.body.id).toBe(createdCustomerId);
        expect(response.body.email).toBe('profilecustomer@example.com');
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('refreshToken');
      });

      it('should return 404 when customer not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .get(`/auth/profile/${fakeId}`)
          .expect(404);
      });
    });

    describe('PATCH /auth/profile/:id', () => {
      it('should update customer profile successfully', async () => {
        const updateDto = {
          full_name: 'Updated Name',
          phone: '0987654321',
          address: '123 Test Street',
        };

        const response = await request(app.getHttpServer())
          .patch(`/auth/profile/${createdCustomerId}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.full_name).toBe(updateDto.full_name);
        expect(response.body.phone).toBe(updateDto.phone);
        expect(response.body.address).toBe(updateDto.address);
      });

      it('should return 404 when customer not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .patch(`/auth/profile/${fakeId}`)
          .send({ full_name: 'Updated Name' })
          .expect(404);
      });
    });

    describe('PATCH /auth/change-password/:id', () => {
      it('should change password successfully', async () => {
        const changePasswordDto = {
          oldPassword: testCustomerPassword,
          newPassword: 'newPassword123',
        };

        const response = await request(app.getHttpServer())
          .patch(`/auth/change-password/${createdCustomerId}`)
          .send(changePasswordDto)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('thành công');

        // Verify new password works
        const loginDto = {
          email: 'profilecustomer@example.com',
          password: 'newPassword123',
        };

        await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)
          .expect(200);
      });

      it('should fail with wrong old password', async () => {
        const changePasswordDto = {
          oldPassword: 'wrongpassword',
          newPassword: 'newPassword123',
        };

        await request(app.getHttpServer())
          .patch(`/auth/change-password/${createdCustomerId}`)
          .send(changePasswordDto)
          .expect(400);
      });

      it('should return 404 when customer not found', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        await request(app.getHttpServer())
          .patch(`/auth/change-password/${fakeId}`)
          .send({
            oldPassword: 'oldpass',
            newPassword: 'newpass',
          })
          .expect(404);
      });
    });
  });

  describe('Password Reset', () => {
    beforeEach(async () => {
      // Create a test customer for password reset tests
      const hashedPassword = await hashPassword(testCustomerPassword);
      const customer = customerRepository.create({
        full_name: 'Test Customer',
        email: 'resetcustomer@example.com',
        password: hashedPassword,
        phone: '0123456789',
        gender: Gender.Male,
        isActive: true,
        refreshToken: '',
      });
      const savedCustomer = await customerRepository.save(customer);
      createdCustomerId = savedCustomer.id;
    });

    describe('POST /auth/forgot-password', () => {
      it('should send reset password email successfully', async () => {
        const forgotPasswordDto = {
          email: 'resetcustomer@example.com',
        };

        const response = await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send(forgotPasswordDto)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('gửi link');

        // Verify reset token was set
        const customer = await customerRepository.findOne({
          where: { email: 'resetcustomer@example.com' },
        });
        expect(customer).not.toBeNull();
        expect(customer).toBeDefined();
        if (customer) {
          expect(customer.resetToken).toBeDefined();
          expect(customer.resetTokenExpire).toBeDefined();
        }
      });

      it('should fail when email does not exist', async () => {
        const forgotPasswordDto = {
          email: 'nonexistent@example.com',
        };

        await request(app.getHttpServer())
          .post('/auth/forgot-password')
          .send(forgotPasswordDto)
          .expect(404);
      });
    });

    describe('POST /auth/reset-password', () => {
      it('should reset password successfully', async () => {
        // First request forgot password to get token
        const customer = await customerRepository.findOne({
          where: { email: 'resetcustomer@example.com' },
        });

        expect(customer).not.toBeNull();
        if (!customer) {
          throw new Error('Customer not found for reset password test');
        }

        // Use JwtService to generate token for testing
        // In a real scenario, the token would come from the forgot-password endpoint
        const jwtService = moduleFixture.get<JwtService>(JwtService);
        const token = await jwtService.signAsync(
          { email: customer.email },
          {
            secret: process.env.JWT_SECRET || 'test-secret-key-12345',
            expiresIn: '15m',
          },
        );

        customer.resetToken = token;
        customer.resetTokenExpire = new Date(Date.now() + 15 * 60 * 1000);
        await customerRepository.save(customer);

        const resetPasswordDto = {
          token: token,
          newPassword: 'resetPassword123',
        };

        const response = await request(app.getHttpServer())
          .post('/auth/reset-password')
          .send(resetPasswordDto)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('thành công');

        // Verify password was changed
        const updatedCustomer = await customerRepository.findOne({
          where: { email: 'resetcustomer@example.com' },
        });
        expect(updatedCustomer).not.toBeNull();
        if (updatedCustomer) {
          expect(updatedCustomer.resetToken).toBeNull();
          expect(updatedCustomer.resetTokenExpire).toBeNull();
        }
      });

      it('should fail with invalid token', async () => {
        const resetPasswordDto = {
          token: 'invalid-token',
          newPassword: 'newPassword123',
        };

        await request(app.getHttpServer())
          .post('/auth/reset-password')
          .send(resetPasswordDto)
          .expect(400);
      });

      it('should fail with expired token', async () => {
        const customer = await customerRepository.findOne({
          where: { email: 'resetcustomer@example.com' },
        });

        expect(customer).not.toBeNull();
        if (!customer) {
          throw new Error('Customer not found for expired token test');
        }

        customer.resetToken = 'expired-token';
        customer.resetTokenExpire = new Date(Date.now() - 1000); // Expired
        await customerRepository.save(customer);

        const resetPasswordDto = {
          token: 'expired-token',
          newPassword: 'newPassword123',
        };

        await request(app.getHttpServer())
          .post('/auth/reset-password')
          .send(resetPasswordDto)
          .expect(400);
      });
    });
  });

  describe('Login with Different Roles', () => {
    it('should login internal staff successfully', async () => {
      // Create test role and staff
      const role = await roleRepository.findOne({
        where: { id: createdRoleId },
      });

      if (!role) {
        throw new Error('Test role not found');
      }

      const hashedPassword = await hashPassword('password123');
      const staff = internalRepository.create({
        full_name: 'Test Staff',
        email: 'staff@test.com',
        password: hashedPassword,
        gender: Gender.Male,
        role: role,
        isActive: true,
        refreshToken: '',
      });
      await internalRepository.save(staff);

      const loginDto = {
        email: 'staff@test.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.email).toBe('staff@test.com');
    });

    it('should login doctor successfully', async () => {
      const hashedPassword = await hashPassword('password123');
      const doctor = doctorRepository.create({
        full_name: 'Test Doctor',
        email: 'doctor@test.com',
        password: hashedPassword,
        gender: Gender.Male,
        specialization: 'Dermatology',
        isActive: true,
        refreshToken: '',
      });
      await doctorRepository.save(doctor);

      const loginDto = {
        email: 'doctor@test.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.email).toBe('doctor@test.com');
      expect(response.body.role).toBe('Doctor');
    });
  });
});

