import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/core';
import { AppHttpException } from '@framework/exception';
import { AuthUserDto } from '@common/dto';
import { IssueHistoryEntity, LoadcellEntity, IssuedItemLocation } from '@dals/mongo/entities';
import { ReturnItemService } from '../return-item.service';
import { IssueItemRepository } from '../../repositories/issue-item.repository';
import { ItemRequest } from '../../dtos/request';
import { PlannedItem } from '@common/business/types';

describe('ReturnItemService', () => {
  let service: ReturnItemService;
  let repository: jest.Mocked<IssueItemRepository>;
  let entityManager: jest.Mocked<EntityManager>;

  // Mock data setup
  const mockUser: AuthUserDto = {
    id: 'user-123',
    username: 'testuser',
    role: 'USER',
    employeeId: 0,
    cardId: 0,
  };

  const mockLoadcells: LoadcellEntity[] = [
    {
      id: 'lc-001',
      item: { id: 'aspirin-123', name: 'Aspirin' },
      bin: {
        id: 'BIN_A',
        loadcells: [
          {
            id: 'lc-001',
            item: { id: 'aspirin-123' },
            bin: { id: 'BIN_A' },
            itemInfo: { itemId: 'aspirin-123' },
            calibration: { quantity: 50 },
          },
          {
            id: 'lc-002',
            item: { id: 'ibuprofen-456' },
            bin: { id: 'BIN_A' },
            itemInfo: { itemId: 'ibuprofen-456' },
            calibration: { quantity: 30 },
          },
        ],
      },
      calibration: { quantity: 50 },
    } as any,
    {
      id: 'lc-004',
      item: { id: 'aspirin-123', name: 'Aspirin' },
      bin: {
        id: 'BIN_B',
        loadcells: [
          {
            id: 'lc-004',
            item: { id: 'aspirin-123' },
            bin: { id: 'BIN_B' },
            itemInfo: { itemId: 'aspirin-123' },
            calibration: { quantity: 30 },
          },
        ],
      },
      calibration: { quantity: 30 },
    } as any,
    {
      id: 'lc-002',
      item: { id: 'ibuprofen-456', name: 'Ibuprofen' },
      bin: {
        id: 'BIN_A',
        loadcells: [
          {
            id: 'lc-001',
            item: { id: 'aspirin-123' },
            bin: { id: 'BIN_A' },
            itemInfo: { itemId: 'aspirin-123' },
            calibration: { quantity: 50 },
          },
          {
            id: 'lc-002',
            item: { id: 'ibuprofen-456' },
            bin: { id: 'BIN_A' },
            itemInfo: { itemId: 'ibuprofen-456' },
            calibration: { quantity: 30 },
          },
        ],
      },
      calibration: { quantity: 30 },
    } as any,
  ];

  const mockIssueHistories: IssueHistoryEntity[] = [
    {
      item: { id: 'aspirin-123' },
      locations: [
        {
          loadcellId: {
            toHexString: () => 'lc-001',
            toString: () => 'lc-001',
          },
          quantity: 30,
        } as IssuedItemLocation,
        {
          loadcellId: {
            toHexString: () => 'lc-004',
            toString: () => 'lc-004',
          },
          quantity: 20,
        } as IssuedItemLocation,
      ],
    } as any,
    {
      item: { id: 'ibuprofen-456' },
      locations: [
        {
          loadcellId: {
            toHexString: () => 'lc-002',
            toString: () => 'lc-002',
          },
          quantity: 15,
        } as IssuedItemLocation,
      ],
    } as any,
  ];

  beforeEach(async () => {
    const mockEntityManager = {
      find: jest.fn(),
    };

    const mockRepository = {
      findUserIssueHistories: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnItemService,
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: IssueItemRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ReturnItemService>(ReturnItemService);
    entityManager = module.get(EntityManager);
    repository = module.get(IssueItemRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('return', () => {
    it('should throw error when no items to return', async () => {
      console.log('\n🧪 Testing: Empty return request');

      const request: ItemRequest = { items: [] };

      await expect(service.return(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({ message: 'Return request must contain at least one item.' }),
      );

      console.log('✅ Correctly threw error for empty return request');
    });

    it('should successfully process single item return to single bin', async () => {
      console.log('\n🧪 Testing: Single item return to single bin');
      console.log('📥 Input: Return 25 units of Aspirin');

      repository.findUserIssueHistories.mockResolvedValue([mockIssueHistories[0]]);
      entityManager.find.mockResolvedValue([mockLoadcells[0]]);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const result = await service.return(mockUser, request);

      console.log('📤 Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
      expect(repository.findUserIssueHistories).toHaveBeenCalledWith('user-123', ['aspirin-123']);
      expect(entityManager.find).toHaveBeenCalled();
      console.log('✅ Successfully processed single item return');
    });

    it('should successfully process return to multiple bins (cross-bin)', async () => {
      console.log('\n🧪 Testing: Cross-bin return');
      console.log('📥 Input: Return 40 units of Aspirin (originally from BIN_A: 30 + BIN_B: 20)');

      repository.findUserIssueHistories.mockResolvedValue([mockIssueHistories[0]]);

      // Mock entityManager.find to return both loadcells for a cross-bin scenario
      entityManager.find.mockResolvedValue(mockLoadcells.filter((lc) => lc.item?.id === 'aspirin-123'));

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 40 }],
      };

      const result = await service.return(mockUser, request);

      console.log('📤 Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
      console.log('✅ Successfully processed cross-bin return');
    });

    it('should throw error when no issue history exists', async () => {
      console.log('\n🧪 Testing: No issue history');
      console.log('📥 Input: User trying to return item they never issued');

      repository.findUserIssueHistories.mockResolvedValue([]);

      const request: ItemRequest = {
        items: [{ itemId: 'nonexistent-item', quantity: 10 }],
      };

      await expect(service.return(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({
          message: 'Item nonexistent-item has no issue history for user.',
        }),
      );

      console.log('✅ Correctly threw error for no issue history');
    });

    it('should throw error when return quantity exceeds issued quantity', async () => {
      console.log('\n🧪 Testing: Excessive return quantity');
      console.log('📥 Input: Try to return 60 units but only issued 50 units');

      repository.findUserIssueHistories.mockResolvedValue([mockIssueHistories[0]]);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 60 }], // More than issued (30+20=50)
      };

      await expect(service.return(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({
          message: 'Cannot return 60 units of aspirin-123. Only issued 50 units.',
        }),
      );

      console.log('✅ Correctly threw error for excessive return quantity');
    });
  });

  describe('_planReturn', () => {
    beforeEach(() => {
      repository.findUserIssueHistories.mockResolvedValue(mockIssueHistories);

      // Setup smart mock for entityManager.find based on query
      entityManager.find.mockImplementation(async (entity, query: any) => {
        console.log('🔍 _planReturn EntityManager.find called with:', JSON.stringify(query, null, 2));

        if (query._id && query._id.$in) {
          const loadcellIds = query._id.$in.map((objectId: any) => {
            if (typeof objectId === 'string') return objectId;
            if (objectId.toHexString) return objectId.toHexString();
            if (objectId.toString) return objectId.toString();
            return String(objectId);
          });

          console.log('🔍 Looking for loadcell IDs:', loadcellIds);
          const found = mockLoadcells.filter((lc) => loadcellIds.includes(lc.id));
          console.log(
            '🔍 Found loadcells:',
            found.map((lc) => lc.id),
          );
          return found;
        }
        return mockLoadcells;
      });
    });

    it('should create correct return plan for single item', async () => {
      console.log('\n🧪 Testing: Return planning for single item');
      console.log('📥 Input: Return 25 units of Aspirin');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const planResult = await (service as any)._planReturn(mockUser, request.items);

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      console.log('  - First plan: Return', planResult.plan[0].requestQty, 'units to', planResult.plan[0].location.binId);
      console.log('  - Total return qty:', planResult.totalReturnQty);

      expect(planResult.plan).toHaveLength(1);
      expect(planResult.plan[0].requestQty).toBe(25);
      expect(planResult.plan[0].location.binId).toBe('BIN_A'); // Should return to first location
      expect(planResult.totalReturnQty).toBe(25);

      console.log('✅ Correctly planned single item return');
    });

    it('should allocate across original bins for cross-bin return', async () => {
      console.log('\n🧪 Testing: Cross-bin return planning');
      console.log('📥 Input: Return 40 units of Aspirin (originally from BIN_A: 30 + BIN_B: 20)');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 40 }],
      };

      const planResult = await (service as any)._planReturn(mockUser, request.items);

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      planResult.plan.forEach((plan: PlannedItem, index: number) => {
        console.log(`  - Plan ${index + 1}: Return ${plan.requestQty} units to ${plan.location.binId} (loadcell: ${plan.loadcellId})`);
      });
      console.log('  - Total return qty:', planResult.totalReturnQty);

      expect(planResult.plan).toHaveLength(2);
      expect(planResult.plan[0].requestQty).toBe(30); // Return 30 to BIN_A
      expect(planResult.plan[0].location.binId).toBe('BIN_A');
      expect(planResult.plan[1].requestQty).toBe(10); // Return 10 to BIN_B
      expect(planResult.plan[1].location.binId).toBe('BIN_B');
      expect(planResult.totalReturnQty).toBe(40);

      console.log('✅ Correctly allocated cross-bin return');
    });

    it('should include keepTrackItems for validation', async () => {
      console.log('\n🧪 Testing: KeepTrackItems inclusion');
      console.log('📥 Input: Return Aspirin, should track other items in target bin');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const planResult = await (service as any)._planReturn(mockUser, request.items);

      console.log('📤 KeepTrackItems:');
      console.log('  - Count:', planResult.plan[0].keepTrackItems.length);
      planResult.plan[0].keepTrackItems.forEach((item: any, index: number) => {
        console.log(`  - Item ${index + 1}: ${item.itemId} (${item.quantity} units) - LoadCell: ${item.loadcellId}`);
      });

      expect(planResult.plan[0].keepTrackItems.length).toBeGreaterThan(0);
      expect(planResult.plan[0].keepTrackItems).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: 'ibuprofen-456' })]));

      console.log('✅ Correctly included keepTrackItems');
    });

    it('should handle partial return correctly', async () => {
      console.log('\n🧪 Testing: Partial return allocation');
      console.log('📥 Input: Return 35 units of Aspirin (less than full issued amount of 50)');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 35 }],
      };

      const planResult = await (service as any)._planReturn(mockUser, request.items);

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      planResult.plan.forEach((plan: PlannedItem, index: number) => {
        console.log(`  - Plan ${index + 1}: Return ${plan.requestQty} units to ${plan.location.binId}`);
      });

      expect(planResult.plan).toHaveLength(2);
      expect(planResult.plan[0].requestQty).toBe(30); // Full amount from first location
      expect(planResult.plan[1].requestQty).toBe(5); // Partial from second location
      expect(planResult.totalReturnQty).toBe(35);

      console.log('✅ Correctly handled partial return');
    });
  });

  describe('_groupReturnPlanByBin', () => {
    it('should create single step for same-bin returns', () => {
      console.log('\n🧪 Testing: Grouping returns to same bin');

      const mockPlan: PlannedItem[] = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 25,
          currentQty: 0,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [{ loadcellId: 'lc-002', itemId: 'ibuprofen-456', binId: 'BIN_A', quantity: 30 }],
        },
        {
          itemId: 'ibuprofen-456',
          name: 'Ibuprofen',
          requestQty: 15,
          currentQty: 0,
          loadcellId: 'lc-002',
          location: { binId: 'BIN_A' },
          keepTrackItems: [{ loadcellId: 'lc-001', itemId: 'aspirin-123', binId: 'BIN_A', quantity: 50 }],
        },
      ];

      console.log('📥 Input Plan:');
      mockPlan.forEach((plan, index) => {
        console.log(`  - Plan ${index + 1}: Return ${plan.requestQty} units of ${plan.itemId} to ${plan.location.binId}`);
      });

      const steps = (service as any)._groupReturnPlanByBin(mockPlan);

      console.log('📤 Generated Steps:');
      console.log('  - Total steps:', steps.length);
      console.log('  - Step 1: Bin =', steps[0].binId);
      console.log('  - Items to return:', steps[0].itemsToReturn.length);
      steps[0].itemsToReturn.forEach((item: any, index: number) => {
        console.log(`    • Item ${index + 1}: ${item.itemId} x${item.requestQty}`);
      });
      console.log('  - Instructions:');
      steps[0].instructions.forEach((instruction: string, index: number) => {
        console.log(`    ${index + 1}. ${instruction}`);
      });

      expect(steps).toHaveLength(1);
      expect(steps[0].binId).toBe('BIN_A');
      expect(steps[0].itemsToReturn).toHaveLength(2);
      expect(steps[0].itemsToReturn).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'aspirin-123', requestQty: 25 }),
          expect.objectContaining({ itemId: 'ibuprofen-456', requestQty: 15 }),
        ]),
      );

      console.log('✅ Successfully grouped same-bin returns into single step');
    });

    it('should create multiple steps for different bins', () => {
      console.log('\n🧪 Testing: Multiple steps for different bins');

      const mockPlan: PlannedItem[] = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 30,
          currentQty: 0,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [],
        },
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 10,
          currentQty: 0,
          loadcellId: 'lc-004',
          location: { binId: 'BIN_B' },
          keepTrackItems: [],
        },
      ];

      console.log('📥 Input Plan:');
      mockPlan.forEach((plan, index) => {
        console.log(`  - Plan ${index + 1}: Return ${plan.requestQty} units of ${plan.itemId} to ${plan.location.binId}`);
      });

      const steps = (service as any)._groupReturnPlanByBin(mockPlan);

      console.log('📤 Generated Steps:');
      console.log('  - Total steps:', steps.length);
      steps.forEach((step: any, index: number) => {
        console.log(`  - Step ${index + 1}: Bin = ${step.binId}, Return = ${step.itemsToReturn[0].requestQty} units`);
        console.log(`    Instructions: ${step.instructions.join(' → ')}`);
      });

      expect(steps).toHaveLength(2);
      expect(steps[0].binId).toBe('BIN_A');
      expect(steps[0].itemsToReturn[0].requestQty).toBe(30);
      expect(steps[1].binId).toBe('BIN_B');
      expect(steps[1].itemsToReturn[0].requestQty).toBe(10);

      console.log('✅ Successfully created multiple steps for different bins');
    });

    it('should generate correct return instructions', () => {
      console.log('\n🧪 Testing: Return instruction generation');

      const mockPlan: PlannedItem[] = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 25,
          currentQty: 0,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [],
        },
      ];

      const steps = (service as any)._groupReturnPlanByBin(mockPlan);

      console.log('📤 Generated Instructions:');
      steps[0].instructions.forEach((instruction: string, index: number) => {
        console.log(`  ${index + 1}. ${instruction}`);
      });

      expect(steps[0].instructions).toEqual(['Step 1: Go to BIN_A', 'Open BIN_A', 'Return 25 units of Aspirin', 'Close BIN_A']);

      console.log('✅ Correctly generated return instructions');
    });

    it('should deduplicate keepTrackItems when multiple returns to same bin', () => {
      console.log('\n🧪 Testing: KeepTrackItems deduplication');

      const mockPlan: PlannedItem[] = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 25,
          currentQty: 0,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [
            { loadcellId: 'lc-002', itemId: 'ibuprofen-456', binId: 'BIN_A', quantity: 30 },
            { loadcellId: 'lc-003', itemId: 'vitamin-789', binId: 'BIN_A', quantity: 20 },
          ],
        },
        {
          itemId: 'paracetamol-999',
          name: 'Paracetamol',
          requestQty: 10,
          currentQty: 0,
          loadcellId: 'lc-005',
          location: { binId: 'BIN_A' },
          keepTrackItems: [
            { loadcellId: 'lc-002', itemId: 'ibuprofen-456', binId: 'BIN_A', quantity: 30 }, // Duplicate
            { loadcellId: 'lc-006', itemId: 'zinc-111', binId: 'BIN_A', quantity: 15 },
          ],
        },
      ];

      console.log('📥 Input KeepTrackItems:');
      mockPlan.forEach((plan, planIndex) => {
        console.log(`  Plan ${planIndex + 1} (${plan.itemId}):`);
        plan.keepTrackItems.forEach((item, itemIndex) => {
          console.log(`    • ${item.itemId} x${item.quantity} (LC: ${item.loadcellId})`);
        });
      });

      const steps = (service as any)._groupReturnPlanByBin(mockPlan);

      console.log('📤 Deduplicated KeepTrackItems:');
      console.log('  - Total unique items:', steps[0].keepTrackItems.length);
      steps[0].keepTrackItems.forEach((item: any, index: number) => {
        console.log(`    • ${item.itemId} x${item.quantity} (LC: ${item.loadcellId})`);
      });

      expect(steps[0].keepTrackItems).toHaveLength(3); // Should be deduplicated
      expect(steps[0].keepTrackItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ loadcellId: 'lc-002', itemId: 'ibuprofen-456' }),
          expect.objectContaining({ loadcellId: 'lc-003', itemId: 'vitamin-789' }),
          expect.objectContaining({ loadcellId: 'lc-006', itemId: 'zinc-111' }),
        ]),
      );

      console.log('✅ Successfully deduplicated keepTrackItems');
    });
  });

  describe('Integration tests', () => {
    it('should handle complex return scenario: multiple items with cross-bin allocation', async () => {
      console.log('\n🧪 Testing: Complex mixed return scenario');
      console.log('📥 Input: Return Aspirin 40 (cross-bin) + Ibuprofen 15 (single bin)');

      repository.findUserIssueHistories.mockResolvedValue(mockIssueHistories);

      // Mock entityManager to return appropriate loadcells based on the query
      entityManager.find.mockImplementation(async (entity, query: any) => {
        console.log('🔍 Complex scenario EntityManager.find called with:', JSON.stringify(query, null, 2));

        if (query._id && query._id.$in) {
          const loadcellIds = query._id.$in.map((objectId: any) => {
            if (typeof objectId === 'string') return objectId;
            if (objectId.toHexString) return objectId.toHexString();
            if (objectId.toString) return objectId.toString();
            return String(objectId);
          });

          console.log('🔍 Complex scenario looking for loadcell IDs:', loadcellIds);
          const found = mockLoadcells.filter((lc) => loadcellIds.includes(lc.id));
          console.log(
            '🔍 Complex scenario found loadcells:',
            found.map((lc) => ({ id: lc.id, itemId: lc.item?.id })),
          );
          return found;
        }

        return mockLoadcells;
      });

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 40 }, // Cross-bin return
          { itemId: 'ibuprofen-456', quantity: 15 }, // Single bin return
        ],
      };

      const result = await service.return(mockUser, request);

      console.log('📤 Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
      expect(repository.findUserIssueHistories).toHaveBeenCalledWith('user-123', ['aspirin-123', 'ibuprofen-456']);

      console.log('✅ Successfully handled complex mixed return scenario');
    });

    it('should validate return plan integrity', async () => {
      console.log('\n🧪 Testing: Return plan integrity validation');
      console.log('📥 Input: Multiple items with specific quantities');

      repository.findUserIssueHistories.mockResolvedValue(mockIssueHistories);
      entityManager.find.mockResolvedValue(mockLoadcells);

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 35 }, // Valid: less than issued (50)
          { itemId: 'ibuprofen-456', quantity: 10 }, // Valid: less than issued (15)
        ],
      };

      // Mock entityManager.find to handle ObjectId conversion properly
      entityManager.find.mockImplementation(async (entity, query: any) => {
        console.log('🔍 EntityManager.find called with query:', JSON.stringify(query, null, 2));

        if (query._id && query._id.$in) {
          // Handle ObjectId conversion - query contains ObjectId objects, need to convert to strings
          const loadcellIds = query._id.$in.map((objectId: any) => {
            // ObjectId might have toHexString() method or be already string
            if (typeof objectId === 'string') {
              return objectId;
            }
            if (objectId.toHexString) {
              return objectId.toHexString();
            }
            if (objectId.toString) {
              return objectId.toString();
            }
            return String(objectId);
          });

          console.log('🔍 Looking for loadcells with IDs:', loadcellIds);
          console.log(
            '🔍 Available mock loadcells:',
            mockLoadcells.map((lc) => ({ id: lc.id, itemId: lc.item?.id })),
          );

          const foundLoadcells = mockLoadcells.filter((lc) => loadcellIds.includes(lc.id));
          console.log(
            '🔍 Found loadcells:',
            foundLoadcells.map((lc) => ({ id: lc.id, itemId: lc.item?.id })),
          );

          return foundLoadcells;
        }

        console.log('🔍 Returning all mock loadcells');
        return mockLoadcells;
      });

      // This should not throw - quantities should be valid for return
      const result = await service.return(mockUser, request);

      expect(result).toBeDefined();
      console.log('✅ Return plan integrity validation passed');
    });
  });
});
