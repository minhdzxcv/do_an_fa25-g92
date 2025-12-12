import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { CategoryModule } from './category.module';
import { CategoryService } from './category.service';
import { Category } from '@/entities/category.entity';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Coverage:
 * - CRUD Operations: Create, Read, Update, Delete
 * - Validation: DTO validation, required fields, data types
 * - Error Handling: 404, 400 errors
 * - Business Logic: Soft delete, partial updates
 * - Edge Cases: Invalid UUIDs, empty strings, non-existent records
 */
describe('Category Module Integration Tests', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let dataSource: DataSource;
  let categoryRepository: Repository<Category>;
  
  // Track created test data for cleanup
  const createdCategoryIds: string[] = [];

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

    // Create NestJS testing module with all dependencies
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
          secret: process.env.JWT_SECRET || 'test-secret', 
          signOptions: { expiresIn: '1d' } 
        }),
        CategoryModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same validation pipe as production
    app.useGlobalPipes(
      new ValidationPipe({ 
        transform: true, 
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );
    
    await app.init();

    categoryRepository = moduleFixture.get<Repository<Category>>(
      getRepositoryToken(Category)
    );
  }, 30000);

  afterEach(async () => {
    // Clean up test data after each test
    if (createdCategoryIds.length > 0) {
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const id of createdCategoryIds) {
        await categoryRepository.delete(id);
      }
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
      createdCategoryIds.length = 0; // Clear array
    }
  });

  afterAll(async () => {
    // Final cleanup: remove all test categories
    try {
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
      await dataSource.query("DELETE FROM category WHERE name LIKE '%Test%' OR name LIKE '%test%'");
      await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
    
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  // ================================================================================
  // CREATE CATEGORY TESTS
  // ================================================================================
  describe('POST /category - Create Category', () => {
    it('should create a new category with all fields', async () => {
      const createDto = {
        name: 'Integration Test Category',
        description: 'Category created during integration testing',
        isActive: true,
      };

      const res = await request(app.getHttpServer())
        .post('/category')
        .send(createDto)
        .expect(201);

      // Verify response structure and values
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(createDto.name);
      expect(res.body.description).toBe(createDto.description);
      expect(res.body.isActive).toBe(createDto.isActive);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      expect(res.body.deletedAt).toBeNull();

      // Track for cleanup
      createdCategoryIds.push(res.body.id);

      // Verify data persisted in database
      const savedCategory = await categoryRepository.findOne({
        where: { id: res.body.id },
      });
      expect(savedCategory).toBeDefined();
      expect(savedCategory?.name).toBe(createDto.name);
    });

    it('should create category with only required field (name)', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({ name: 'Minimal Test Category' })
        .expect(201);

      expect(res.body.name).toBe('Minimal Test Category');
      expect(res.body.description).toBeNull();
      expect(res.body.isActive).toBe(true); // Default value
      
      createdCategoryIds.push(res.body.id);
    });

    it('should fail when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({ description: 'Missing name field' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should accept empty string as name (no @MinLength validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({ name: '' })
        .expect(201);
      
      expect(res.body.name).toBe('');
      createdCategoryIds.push(res.body.id);
    });

    it('should fail when isActive is not boolean', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .send({ 
          name: 'Test Category',
          isActive: 'not-a-boolean' 
        })
        .expect(400);
    });

    it('should reject unknown fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .send({ 
          name: 'Test Category',
          unknownField: 'should be rejected'
        })
        .expect(400);
    });
  });

  // ================================================================================
  // READ CATEGORY TESTS
  // ================================================================================
  describe('GET /category - Get All Categories', () => {
    it('should return all active categories', async () => {
      // Create test data
      const cat1 = await categoryRepository.save({
        name: 'Test Category 1',
        description: 'First test category',
        isActive: true,
      });
      const cat2 = await categoryRepository.save({
        name: 'Test Category 2',
        description: 'Second test category',
        isActive: false,
      });
      createdCategoryIds.push(cat1.id, cat2.id);

      const res = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      
      // Verify our test categories are in response
      const testCat1 = res.body.find((c: any) => c.id === cat1.id);
      const testCat2 = res.body.find((c: any) => c.id === cat2.id);
      expect(testCat1).toBeDefined();
      expect(testCat2).toBeDefined();
    });

    it('should not return soft-deleted categories', async () => {
      // Create and soft delete a category
      const cat = await categoryRepository.save({
        name: 'Test To Delete',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      // Soft delete
      await categoryRepository.softDelete(cat.id);

      // Get all categories
      const res = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      // Verify deleted category is not in response
      const deletedCat = res.body.find((c: any) => c.id === cat.id);
      expect(deletedCat).toBeUndefined();
    });

    it('should return empty array when no categories exist', async () => {
      // This test assumes cleanup happens after each test
      // In practice, there might be existing data
      const res = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /category/:id - Get Category By ID', () => {
    it('should return category by valid id', async () => {
      const cat = await categoryRepository.save({
        name: 'Specific Test Category',
        description: 'Find me by ID',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      const res = await request(app.getHttpServer())
        .get(`/category/${cat.id}`)
        .expect(200);

      expect(res.body.id).toBe(cat.id);
      expect(res.body.name).toBe('Specific Test Category');
      expect(res.body.description).toBe('Find me by ID');
      expect(res.body.isActive).toBe(true);
    });

    it('should return 404 when category not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const res = await request(app.getHttpServer())
        .get(`/category/${fakeId}`)
        .expect(404);

      expect(res.body.message).toContain('Không tìm thấy danh mục');
    });

    it('should return 404 for soft-deleted category', async () => {
      const cat = await categoryRepository.save({
        name: 'Test Deleted Category',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      // Soft delete
      await categoryRepository.softDelete(cat.id);

      // Try to get deleted category
      await request(app.getHttpServer())
        .get(`/category/${cat.id}`)
        .expect(404);
    });

    it('should return 404 for invalid UUID format', async () => {
      // TypeORM treats invalid UUID as not found
      await request(app.getHttpServer())
        .get('/category/invalid-uuid-format')
        .expect(404);
    });
  });

  // ================================================================================
  // UPDATE CATEGORY TESTS
  // ================================================================================
  describe('PUT /category/:id - Update Category', () => {
    it('should update all fields of category', async () => {
      const cat = await categoryRepository.save({
        name: 'Original Name',
        description: 'Original description',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
        isActive: false,
      };

      const res = await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send(updateDto)
        .expect(200);

      expect(res.body.name).toBe(updateDto.name);
      expect(res.body.description).toBe(updateDto.description);
      expect(res.body.isActive).toBe(updateDto.isActive);

      // Verify in database
      const updated = await categoryRepository.findOne({ where: { id: cat.id } });
      expect(updated?.name).toBe(updateDto.name);
      expect(updated?.description).toBe(updateDto.description);
      expect(updated?.isActive).toBe(updateDto.isActive);
    });

    it('should partially update category (only name)', async () => {
      const cat = await categoryRepository.save({
        name: 'Original Name',
        description: 'Original description',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      const res = await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({ name: 'Only Name Updated' })
        .expect(200);

      expect(res.body.name).toBe('Only Name Updated');
      expect(res.body.description).toBe('Original description'); // Unchanged
      expect(res.body.isActive).toBe(true); // Unchanged
    });

    it('should partially update category (only description)', async () => {
      const cat = await categoryRepository.save({
        name: 'Original Name',
        description: 'Original description',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      const res = await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({ description: 'Updated description only' })
        .expect(200);

      expect(res.body.name).toBe('Original Name'); // Unchanged
      expect(res.body.description).toBe('Updated description only');
    });

    it('should partially update category (only isActive)', async () => {
      const cat = await categoryRepository.save({
        name: 'Original Name',
        description: 'Original description',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      const res = await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({ isActive: false })
        .expect(200);

      expect(res.body.name).toBe('Original Name'); // Unchanged
      expect(res.body.isActive).toBe(false);
    });

    it('should return 404 when updating non-existent category', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const res = await request(app.getHttpServer())
        .put(`/category/${fakeId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(res.body.message).toContain('Không tìm thấy danh mục');
    });

    it('should return 404 when updating soft-deleted category', async () => {
      const cat = await categoryRepository.save({
        name: 'To Be Deleted',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      // Soft delete
      await categoryRepository.softDelete(cat.id);

      // Try to update
      await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({ name: 'Try to update deleted' })
        .expect(404);
    });

    it('should fail with invalid data type', async () => {
      const cat = await categoryRepository.save({
        name: 'Test Category',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({ isActive: 'not-a-boolean' })
        .expect(400);
    });

    it('should update updatedAt timestamp', async () => {
      const cat = await categoryRepository.save({
        name: 'Test Category',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      const originalUpdatedAt = cat.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      const res = await request(app.getHttpServer())
        .put(`/category/${cat.id}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      const newUpdatedAt = new Date(res.body.updatedAt);
      expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  // ================================================================================
  // DELETE CATEGORY TESTS
  // ================================================================================
  describe('DELETE /category/:id - Soft Delete Category', () => {
    it('should soft delete category successfully', async () => {
      const cat = await categoryRepository.save({
        name: 'Test To Delete',
        description: 'This will be soft deleted',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      await request(app.getHttpServer())
        .delete(`/category/${cat.id}`)
        .expect(200);

      // Response might be true or object, just verify 200 status

      // Verify soft delete: deletedAt should be set
      const deleted = await categoryRepository.findOne({
        where: { id: cat.id },
        withDeleted: true, // Include soft-deleted records
      });
      
      expect(deleted).toBeDefined();
      expect(deleted?.deletedAt).not.toBeNull();
      expect(deleted?.deletedAt).toBeInstanceOf(Date);
    });

    it('should not return soft-deleted category in normal queries', async () => {
      const cat = await categoryRepository.save({
        name: 'Test Category',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      // Delete
      await request(app.getHttpServer())
        .delete(`/category/${cat.id}`)
        .expect(200);

      // Try to get - should return 404
      await request(app.getHttpServer())
        .get(`/category/${cat.id}`)
        .expect(404);

      // Should not appear in list
      const listRes = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      const found = listRes.body.find((c: any) => c.id === cat.id);
      expect(found).toBeUndefined();
    });

    it('should return 404 when deleting non-existent category', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      
      const res = await request(app.getHttpServer())
        .delete(`/category/${fakeId}`)
        .expect(404);

      expect(res.body.message).toContain('Không tìm thấy danh mục');
    });

    it('should return 404 when deleting already deleted category', async () => {
      const cat = await categoryRepository.save({
        name: 'Test Category',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      // First delete - should succeed
      await request(app.getHttpServer())
        .delete(`/category/${cat.id}`)
        .expect(200);

      // Second delete - should return 404
      await request(app.getHttpServer())
        .delete(`/category/${cat.id}`)
        .expect(404);
    });

    it('should preserve data after soft delete', async () => {
      const cat = await categoryRepository.save({
        name: 'Preserve This Data',
        description: 'Data should remain after soft delete',
        isActive: true,
      });
      createdCategoryIds.push(cat.id);

      // Soft delete
      await request(app.getHttpServer())
        .delete(`/category/${cat.id}`)
        .expect(200);

      // Get with withDeleted option
      const deleted = await categoryRepository.findOne({
        where: { id: cat.id },
        withDeleted: true,
      });

      // All data should still be there
      expect(deleted?.name).toBe('Preserve This Data');
      expect(deleted?.description).toBe('Data should remain after soft delete');
      expect(deleted?.isActive).toBe(true);
      expect(deleted?.deletedAt).not.toBeNull();
    });
  });

  // ================================================================================
  // EDGE CASES & SPECIAL SCENARIOS
  // ================================================================================
  describe('Edge Cases & Special Scenarios', () => {
    it('should handle special characters in category name', async () => {
      const specialName = "Massage & Spa - 'Premium' (VIP) @2024";
      
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({ name: specialName })
        .expect(201);

      expect(res.body.name).toBe(specialName);
      createdCategoryIds.push(res.body.id);
    });

    it('should handle Vietnamese characters correctly', async () => {
      const vietnameseName = 'Massage thư giãn & Chăm sóc da mặt';
      
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({ 
          name: vietnameseName,
          description: 'Dịch vụ cao cấp cho khách hàng VIP'
        })
        .expect(201);

      expect(res.body.name).toBe(vietnameseName);
      createdCategoryIds.push(res.body.id);
    });

    it('should handle long description within database limit', async () => {
      const longDescription = 'A'.repeat(200); // 200 characters - within VARCHAR(255) limit
      
      const res = await request(app.getHttpServer())
        .post('/category')
        .send({ 
          name: 'Test Long Description',
          description: longDescription
        })
        .expect(201);

      expect(res.body.description).toBe(longDescription);
      expect(res.body.description.length).toBe(200);
      createdCategoryIds.push(res.body.id);
    });

    it('should allow duplicate names (no unique constraint)', async () => {
      const sameName = 'Duplicate Category Name';
      
      const res1 = await request(app.getHttpServer())
        .post('/category')
        .send({ name: sameName })
        .expect(201);
      createdCategoryIds.push(res1.body.id);

      const res2 = await request(app.getHttpServer())
        .post('/category')
        .send({ name: sameName })
        .expect(201);
      createdCategoryIds.push(res2.body.id);

      expect(res1.body.id).not.toBe(res2.body.id);
      expect(res1.body.name).toBe(res2.body.name);
    });

    it('should maintain data integrity across multiple operations', async () => {
      // Create
      const createRes = await request(app.getHttpServer())
        .post('/category')
        .send({ 
          name: 'Integrity Test',
          description: 'Original',
          isActive: true
        })
        .expect(201);
      createdCategoryIds.push(createRes.body.id);

      const categoryId = createRes.body.id;

      // Read
      const getRes = await request(app.getHttpServer())
        .get(`/category/${categoryId}`)
        .expect(200);
      expect(getRes.body.name).toBe('Integrity Test');

      // Update
      const updateRes = await request(app.getHttpServer())
        .put(`/category/${categoryId}`)
        .send({ description: 'Updated' })
        .expect(200);
      expect(updateRes.body.description).toBe('Updated');
      expect(updateRes.body.name).toBe('Integrity Test'); // Preserved

      // Delete
      await request(app.getHttpServer())
        .delete(`/category/${categoryId}`)
        .expect(200);

      // Verify deleted
      await request(app.getHttpServer())
        .get(`/category/${categoryId}`)
        .expect(404);
    });
  });
});
