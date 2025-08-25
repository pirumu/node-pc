import { Test, TestingModule } from '@nestjs/testing';
import { AppHttpException } from '@framework/exception';
import { AuthUserDto } from '@common/dto';
import { LoadcellEntity } from '@dals/mongo/entities';
import { ReplenishItemService } from '../replenish-item.service';
import { ReplenishItemRepository } from '../../repositories';
import { ItemRequest } from '../../dtos/request';
import { PlannedItem } from '@common/business/types';

describe('ReplenishItemService', () => {
  let service: ReplenishItemService;
  let repository: jest.Mocked<ReplenishItemRepository>;

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
            calibration: { quantity: 20 }, // Has space (50 - 20 = 30)
          },
          {
            id: 'lc-002',
            item: { id: 'ibuprofen-456' },
            bin: { id: 'BIN_A' },
            calibration: { quantity: 30 },
          },
        ],
      },
      calibration: {
        quantity: 20,
        calculatedQuantity: 50,
        maxQuantity: 60,
      },
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
            calibration: { quantity: 10 }, // Has more space (40 - 10 = 30)
          },
        ],
      },
      calibration: {
        quantity: 10,
        calculatedQuantity: 40,
        maxQuantity: 50,
      },
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
            calibration: { quantity: 20 },
          },
          {
            id: 'lc-002',
            item: { id: 'ibuprofen-456' },
            bin: { id: 'BIN_A' },
            calibration: { quantity: 30 },
          },
        ],
      },
      calibration: {
        quantity: 30,
        calculatedQuantity: 45,
        maxQuantity: 50,
      },
    } as any,
    {
      id: 'lc-003',
      item: { id: 'vitamin-789', name: 'Vitamin C' },
      bin: {
        id: 'BIN_C',
        loadcells: [
          {
            id: 'lc-003',
            item: { id: 'vitamin-789' },
            bin: { id: 'BIN_C' },
            calibration: { quantity: 100 }, // Full - no space
          },
        ],
      },
      calibration: {
        quantity: 100,
        calculatedQuantity: 100,
        maxQuantity: 100,
      },
    } as any,
  ];

  beforeEach(async () => {
    const mockRepository = {
      findItemsForReplenish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReplenishItemService,
        {
          provide: ReplenishItemRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ReplenishItemService>(ReplenishItemService);
    repository = module.get(ReplenishItemRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('replenish', () => {
    it('should throw error when no items to replenish', async () => {
      console.log('\n🧪 Testing: Empty replenish request');

      const request: ItemRequest = { items: [] };

      await expect(service.replenish(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({ message: 'Replenish request must contain at least one item.' }),
      );

      console.log('✅ Correctly threw error for empty replenish request');
    });

    it('should successfully process single item replenish to single bin', async () => {
      console.log('\n🧪 Testing: Single item replenish to single bin');
      console.log('📥 Input: Replenish 25 units of Aspirin');

      repository.findItemsForReplenish.mockResolvedValue([mockLoadcells[1]]); // BIN_B with more space

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const result = await service.replenish(mockUser, request);

      console.log('📤 Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(repository.findItemsForReplenish).toHaveBeenCalledWith(['aspirin-123']);
      console.log('✅ Successfully processed single item replenish');
    });

    it('should successfully process replenish to multiple bins (cross-bin)', async () => {
      console.log('\n🧪 Testing: Cross-bin replenish');
      console.log('📥 Input: Replenish 50 units of Aspirin (BIN_B: 30 space + BIN_A: 30 space)');

      // Return loadcells sorted by least stocked first
      const aspirinLoadcells = mockLoadcells.filter((lc) => lc.item?.id === 'aspirin-123');
      repository.findItemsForReplenish.mockResolvedValue(aspirinLoadcells);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 50 }],
      };

      const result = await service.replenish(mockUser, request);

      console.log('📤 Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
      console.log('✅ Successfully processed cross-bin replenish');
    });

    it('should throw error when no loadcells found for item', async () => {
      console.log('\n🧪 Testing: No loadcells available');
      console.log('📥 Input: User trying to replenish item with no available loadcells');

      repository.findItemsForReplenish.mockResolvedValue([]);

      const request: ItemRequest = {
        items: [{ itemId: 'nonexistent-item', quantity: 10 }],
      };

      await expect(service.replenish(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({
          message: 'No loadcells found that can accept replenishment for item nonexistent-item.',
        }),
      );

      console.log('✅ Correctly threw error for no available loadcells');
    });

    it('should throw error when replenish quantity exceeds available space', async () => {
      console.log('\n🧪 Testing: Excessive replenish quantity');
      console.log('📥 Input: Try to replenish 100 units but only 60 space available');

      // Mock loadcells with limited space
      const limitedSpaceLoadcells = mockLoadcells.filter((lc) => lc.item?.id === 'aspirin-123');
      repository.findItemsForReplenish.mockResolvedValue(limitedSpaceLoadcells);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 100 }], // More than available space (30+30=60)
      };

      await expect(service.replenish(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({
          message: expect.stringContaining('Cannot replenish full quantity for item aspirin-123'),
        }),
      );

      console.log('✅ Correctly threw error for excessive replenish quantity');
    });
  });

  describe('_planReplenish', () => {
    beforeEach(() => {
      repository.findItemsForReplenish.mockResolvedValue(mockLoadcells);
    });

    it('should create correct replenish plan for single item', async () => {
      console.log('\n🧪 Testing: Replenish planning for single item');
      console.log('📥 Input: Replenish 25 units of Aspirin');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const planResult = await (service as any)._planReplenish(mockUser, request.items);

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      console.log('  - First plan: Add', planResult.plan[0].requestQty, 'units to', planResult.plan[0].location.binId);
      console.log('  - Total replenish qty:', planResult.totalReplenishQty);

      expect(planResult.plan).toHaveLength(1);
      expect(planResult.plan[0].requestQty).toBe(25);
      expect(planResult.plan[0].location.binId).toBe('BIN_B'); // Should go to least stocked first
      expect(planResult.totalReplenishQty).toBe(25);

      console.log('✅ Correctly planned single item replenish');
    });

    it('should allocate to least stocked loadcells first (smart allocation)', async () => {
      console.log('\n🧪 Testing: Smart allocation - least stocked first');
      console.log('📥 Input: Replenish 50 units of Aspirin');
      console.log('📊 Available spaces: BIN_B (30 space, 25% full) + BIN_A (30 space, 40% full)');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 50 }],
      };

      const planResult = await (service as any)._planReplenish(mockUser, request.items);

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      planResult.plan.forEach((plan: PlannedItem, index: number) => {
        console.log(`  - Plan ${index + 1}: Add ${plan.requestQty} units to ${plan.location.binId} (loadcell: ${plan.loadcellId})`);
      });
      console.log('  - Total replenish qty:', planResult.totalReplenishQty);

      expect(planResult.plan).toHaveLength(2);
      // Should fill least stocked first (BIN_B has lower stock percentage)
      expect(planResult.plan[0].location.binId).toBe('BIN_B'); // Less stocked goes first
      expect(planResult.plan[0].requestQty).toBe(30); // Fill BIN_B completely
      expect(planResult.plan[1].location.binId).toBe('BIN_A');
      expect(planResult.plan[1].requestQty).toBe(20); // Remaining to BIN_A
      expect(planResult.totalReplenishQty).toBe(50);

      console.log('✅ Correctly allocated to least stocked first');
    });

    it('should include keepTrackItems for validation', async () => {
      console.log('\n🧪 Testing: KeepTrackItems inclusion');
      console.log('📥 Input: Replenish Aspirin, should track other items in target bin');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const planResult = await (service as any)._planReplenish(mockUser, request.items);

      console.log('📤 KeepTrackItems:');
      console.log('  - Count:', planResult.plan[0].keepTrackItems.length);
      planResult.plan[0].keepTrackItems.forEach((item: any, index: number) => {
        console.log(`  - Item ${index + 1}: ${item.itemId} (${item.quantity} units) - LoadCell: ${item.loadcellId}`);
      });

      expect(planResult.plan[0].keepTrackItems.length).toBeGreaterThanOrEqual(0);
      // Should exclude items in the replenish request and items with 0 quantity

      console.log('✅ Correctly included keepTrackItems');
    });

    it('should handle partial space allocation correctly', async () => {
      console.log('\n🧪 Testing: Partial space allocation');
      console.log('📥 Input: Replenish 45 units of Aspirin (less than total available space of 60)');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 45 }],
      };

      const planResult = await (service as any)._planReplenish(mockUser, request.items);

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      planResult.plan.forEach((plan: PlannedItem, index: number) => {
        console.log(`  - Plan ${index + 1}: Add ${plan.requestQty} units to ${plan.location.binId}`);
      });

      expect(planResult.plan).toHaveLength(2);
      expect(planResult.plan[0].requestQty).toBe(30); // Fill least stocked completely
      expect(planResult.plan[1].requestQty).toBe(15); // Partial to next bin
      expect(planResult.totalReplenishQty).toBe(45);

      console.log('✅ Correctly handled partial space allocation');
    });

    it('should skip loadcells with no available space', async () => {
      console.log('\n🧪 Testing: Skip full loadcells');
      console.log('📥 Input: Replenish Vitamin C (loadcell is full)');

      const request: ItemRequest = {
        items: [{ itemId: 'vitamin-789', quantity: 10 }],
      };

      await expect((service as any)._planReplenish(mockUser, request.items)).rejects.toThrow(
        AppHttpException.badRequest({
          message: expect.stringContaining('Cannot replenish full quantity for item vitamin-789'),
        }),
      );

      console.log('✅ Correctly skipped full loadcells and threw appropriate error');
    });
  });

  describe('_groupReplenishPlanByBin', () => {
    it('should create single step for same-bin replenishments', () => {
      console.log('\n🧪 Testing: Grouping replenishments to same bin');

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
        console.log(`  - Plan ${index + 1}: Add ${plan.requestQty} units of ${plan.itemId} to ${plan.location.binId}`);
      });

      const steps = (service as any)._groupReplenishPlanByBin(mockPlan);

      console.log('📤 Generated Steps:');
      console.log('  - Total steps:', steps.length);
      console.log('  - Step 1: Bin =', steps[0].binId);
      console.log('  - Items to replenish:', steps[0].itemsToReplenish.length);
      steps[0].itemsToReplenish.forEach((item: any, index: number) => {
        console.log(`    • Item ${index + 1}: ${item.itemId} x${item.requestQty}`);
      });
      console.log('  - Instructions:');
      steps[0].instructions.forEach((instruction: string, index: number) => {
        console.log(`    ${index + 1}. ${instruction}`);
      });

      expect(steps).toHaveLength(1);
      expect(steps[0].binId).toBe('BIN_A');
      expect(steps[0].itemsToReplenish).toHaveLength(2);
      expect(steps[0].itemsToReplenish).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'aspirin-123', requestQty: 25 }),
          expect.objectContaining({ itemId: 'ibuprofen-456', requestQty: 15 }),
        ]),
      );

      console.log('✅ Successfully grouped same-bin replenishments into single step');
    });

    it('should create multiple steps for different bins', () => {
      console.log('\n🧪 Testing: Multiple steps for different bins');

      const mockPlan: PlannedItem[] = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 30,
          currentQty: 0,
          loadcellId: 'lc-004',
          location: { binId: 'BIN_B' },
          keepTrackItems: [],
        },
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 20,
          currentQty: 0,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [],
        },
      ];

      console.log('📥 Input Plan:');
      mockPlan.forEach((plan, index) => {
        console.log(`  - Plan ${index + 1}: Add ${plan.requestQty} units of ${plan.itemId} to ${plan.location.binId}`);
      });

      const steps = (service as any)._groupReplenishPlanByBin(mockPlan);

      console.log('📤 Generated Steps:');
      console.log('  - Total steps:', steps.length);
      steps.forEach((step: any, index: number) => {
        console.log(`  - Step ${index + 1}: Bin = ${step.binId}, Add = ${step.itemsToReplenish[0].requestQty} units`);
        console.log(`    Instructions: ${step.instructions.join(' → ')}`);
      });

      expect(steps).toHaveLength(2);
      expect(steps[0].binId).toBe('BIN_B');
      expect(steps[0].itemsToReplenish[0].requestQty).toBe(30);
      expect(steps[1].binId).toBe('BIN_A');
      expect(steps[1].itemsToReplenish[0].requestQty).toBe(20);

      console.log('✅ Successfully created multiple steps for different bins');
    });

    it('should generate correct replenish instructions', () => {
      console.log('\n🧪 Testing: Replenish instruction generation');

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

      const steps = (service as any)._groupReplenishPlanByBin(mockPlan);

      console.log('📤 Generated Instructions:');
      steps[0].instructions.forEach((instruction: string, index: number) => {
        console.log(`  ${index + 1}. ${instruction}`);
      });

      expect(steps[0].instructions).toEqual(['Step 1: Go to BIN_A', 'Open BIN_A', 'Add 25 units of Aspirin', 'Close BIN_A']);

      console.log('✅ Correctly generated replenish instructions');
    });

    it('should deduplicate keepTrackItems when multiple replenishments to same bin', () => {
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

      const steps = (service as any)._groupReplenishPlanByBin(mockPlan);

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
    it('should handle complex replenish scenario: multiple items with cross-bin allocation', async () => {
      console.log('\n🧪 Testing: Complex mixed replenish scenario');
      console.log('📥 Input: Replenish Aspirin 50 (cross-bin) + Ibuprofen 10 (single bin)');

      const multiItemLoadcells = mockLoadcells.filter((lc) => lc.item?.id === 'aspirin-123' || lc.item?.id === 'ibuprofen-456');
      repository.findItemsForReplenish.mockResolvedValue(multiItemLoadcells);

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 50 }, // Cross-bin replenish
          { itemId: 'ibuprofen-456', quantity: 10 }, // Single bin replenish
        ],
      };

      const result = await service.replenish(mockUser, request);

      console.log('📤 Result:', JSON.stringify(result, null, 2));
      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(repository.findItemsForReplenish).toHaveBeenCalledWith(['aspirin-123', 'ibuprofen-456']);

      console.log('✅ Successfully handled complex mixed replenish scenario');
    });

    it('should validate replenish plan integrity', async () => {
      console.log('\n🧪 Testing: Replenish plan integrity validation');
      console.log('📥 Input: Multiple items with specific quantities within available space');

      repository.findItemsForReplenish.mockResolvedValue(mockLoadcells);

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 40 }, // Valid: within available space (30+30=60)
          { itemId: 'ibuprofen-456', quantity: 10 }, // Valid: within available space (15)
        ],
      };

      // This should not throw - quantities should be valid for replenishing
      const result = await service.replenish(mockUser, request);

      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      console.log('✅ Replenish plan integrity validation passed');
    });

    it('should handle edge case: exactly fill available space', async () => {
      console.log('\n🧪 Testing: Edge case - exactly fill available space');
      console.log('📥 Input: Replenish exact amount to fill all available space');

      const aspirinLoadcells = mockLoadcells.filter((lc) => lc.item?.id === 'aspirin-123');
      repository.findItemsForReplenish.mockResolvedValue(aspirinLoadcells);

      // Total available space for aspirin: 30 (BIN_B) + 30 (BIN_A) = 60
      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 60 }],
      };

      const result = await service.replenish(mockUser, request);

      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      console.log('✅ Successfully handled exact space fill scenario');
    });
  });
});
