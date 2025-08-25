import { Test, TestingModule } from '@nestjs/testing';
import { AppHttpException } from '@framework/exception';
import { IssueItemService } from '../issue-item.service';
import { AuthUserDto } from '@common/dto';
import { IssueItemRepository } from '../../repositories';
import { ItemRequest } from '../../dtos/request';
import { PlannedItem } from '@dals/mongo/entities';

describe('IssueItemService', () => {
  let service: IssueItemService;
  let repository: jest.Mocked<IssueItemRepository>;

  // Mock data setup
  const mockUser: AuthUserDto = {
    id: 'user-123',
    username: 'testuser',
    role: 'USER',
    employeeId: 0,
    cardId: 0,
  };

  const mockLoadcells: any[] = [
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
          {
            id: 'lc-003',
            item: { id: 'vitamin-789' },
            bin: { id: 'BIN_A' },
            itemInfo: { itemId: 'vitamin-789' },
            calibration: { quantity: 20 },
          },
        ],
      },
      calibration: { quantity: 50 },
    },
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
          {
            id: 'lc-005',
            item: { id: 'paracetamol-999' },
            bin: { id: 'BIN_B' },
            itemInfo: { itemId: 'paracetamol-999' },
            calibration: { quantity: 40 },
          },
        ],
      },
      calibration: { quantity: 30 },
    },
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
          {
            id: 'lc-003',
            item: { id: 'vitamin-789' },
            bin: { id: 'BIN_A' },
            itemInfo: { itemId: 'vitamin-789' },
            calibration: { quantity: 20 },
          },
        ],
      },
      calibration: { quantity: 30 },
    },
  ];

  const mockUserHistories: any[] = [
    {
      item: { id: 'aspirin-123' },
      locations: [{ binId: { toHexString: () => 'BIN_A' } }],
    },
  ];

  beforeEach(async () => {
    const mockRepository = {
      findItemsForIssue: jest.fn(),
      findUserIssueHistories: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueItemService,
        {
          provide: IssueItemRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<IssueItemService>(IssueItemService);
    repository = module.get(IssueItemRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issue', () => {
    it('should throw error when no items requested', async () => {
      console.log('\n🧪 Testing: Empty items request');
      const request: ItemRequest = { items: [] };

      await expect(service.issue(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({ message: 'Request must contain at least one item.' }),
      );
      console.log('✅ Correctly threw error for empty items');
    });

    it('should throw error when items is null', async () => {
      console.log('\n🧪 Testing: Null items request');
      const request: ItemRequest = { items: null as any };

      await expect(service.issue(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({ message: 'Request must contain at least one item.' }),
      );
      console.log('✅ Correctly threw error for null items');
    });

    it('should successfully process single item from single bin', async () => {
      console.log('\n🧪 Testing: Single item from single bin');
      console.log('📥 Input: Aspirin 25 units from BIN_A');

      repository.findItemsForIssue.mockResolvedValue([mockLoadcells[0]]);
      repository.findUserIssueHistories.mockResolvedValue(mockUserHistories);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const result = await service.issue(mockUser, request);
      console.log('📤 Result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(repository.findItemsForIssue).toHaveBeenCalledWith({
        itemIds: ['aspirin-123'],
        expiryDate: expect.any(Number),
      });
      expect(repository.findUserIssueHistories).toHaveBeenCalledWith('user-123', ['aspirin-123']);
      console.log('✅ Successfully processed single item');
    });

    it('should successfully process multiple items from single bin', async () => {
      console.log('\n🧪 Testing: Multiple items from single bin');
      console.log('📥 Input: Aspirin 25 + Ibuprofen 15 from BIN_A');

      repository.findItemsForIssue.mockResolvedValue([mockLoadcells[0], mockLoadcells[2]]);
      repository.findUserIssueHistories.mockResolvedValue(mockUserHistories);

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 25 },
          { itemId: 'ibuprofen-456', quantity: 15 },
        ],
      };

      const result = await service.issue(mockUser, request);
      console.log('📤 Result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(repository.findItemsForIssue).toHaveBeenCalledWith({
        itemIds: ['aspirin-123', 'ibuprofen-456'],
        expiryDate: expect.any(Number),
      });
      console.log('✅ Successfully processed multiple items from same bin');
    });

    it('should successfully process single item from multiple bins (cross-bin)', async () => {
      console.log('\n🧪 Testing: Single item from multiple bins (cross-bin)');
      console.log('📥 Input: Aspirin 70 units (requires BIN_A + BIN_B)');

      repository.findItemsForIssue.mockResolvedValue([mockLoadcells[0], mockLoadcells[1]]);
      repository.findUserIssueHistories.mockResolvedValue(mockUserHistories);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 70 }], // More than single bin can provide
      };

      const result = await service.issue(mockUser, request);
      console.log('📤 Result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      console.log('✅ Successfully processed cross-bin allocation');
    });

    it('should throw error when item is not available', async () => {
      console.log('\n🧪 Testing: Item not available');
      console.log('📥 Input: Nonexistent item');

      repository.findItemsForIssue.mockResolvedValue([]);
      repository.findUserIssueHistories.mockResolvedValue([]);

      const request: ItemRequest = {
        items: [{ itemId: 'nonexistent-item', quantity: 10 }],
      };

      await expect(service.issue(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({
          message: 'Item nonexistent-item is not available in any active bin.',
        }),
      );
      console.log('✅ Correctly threw error for unavailable item');
    });

    it('should throw error when insufficient stock', async () => {
      console.log('\n🧪 Testing: Insufficient stock');
      console.log('📥 Input: Aspirin 100 units (only 50 available)');

      repository.findItemsForIssue.mockResolvedValue([mockLoadcells[0]]);
      repository.findUserIssueHistories.mockResolvedValue([]);

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 100 }], // More than available (50)
      };

      await expect(service.issue(mockUser, request)).rejects.toThrow(
        AppHttpException.badRequest({
          message: 'Not enough stock for item aspirin-123. Requested: 100, Available: 50.',
        }),
      );
      console.log('✅ Correctly threw error for insufficient stock');
    });
  });

  describe('_planWithdrawal', () => {
    beforeEach(() => {
      repository.findItemsForIssue.mockResolvedValue(mockLoadcells);
      repository.findUserIssueHistories.mockResolvedValue(mockUserHistories);
    });

    it('should prioritize bins user has used before', async () => {
      console.log('\n🧪 Testing: Bin prioritization based on user history');
      console.log('📥 Input: Aspirin 25 units, user previously used BIN_A');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      // Use reflection to access private method for testing
      const planResult = await (service as any)._planWithdrawal(mockUser, request.items, Date.now());

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      console.log('  - First plan bin:', planResult.plan[0].location.binId);
      console.log('  - Total request qty:', planResult.totalRequestQty);
      console.log(
        '  - keepTrackItems:',
        planResult.plan[0].keepTrackItems.map((item: any) => `${item.itemId} x${item.quantity}`),
      );

      expect(planResult.plan).toHaveLength(1);
      expect(planResult.plan[0].location.binId).toBe('BIN_A'); // Should prioritize BIN_A from history
      expect(planResult.totalRequestQty).toBe(25);
      console.log("✅ Correctly prioritized user's previous bin");
    });

    it('should allocate across multiple bins when needed', async () => {
      console.log('\n🧪 Testing: Cross-bin allocation');
      console.log('📥 Input: Aspirin 70 units (BIN_A has 50, BIN_B has 30)');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 70 }], // Requires both BIN_A (50) + BIN_B (30)
      };

      const planResult = await (service as any)._planWithdrawal(mockUser, request.items, Date.now());

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      console.log('  - Plan 1: Bin =', planResult.plan[0].location.binId, ', Qty =', planResult.plan[0].requestQty);
      console.log('  - Plan 2: Bin =', planResult.plan[1].location.binId, ', Qty =', planResult.plan[1].requestQty);
      console.log('  - Total request qty:', planResult.totalRequestQty);

      expect(planResult.plan).toHaveLength(2);
      expect(planResult.plan[0].location.binId).toBe('BIN_A'); // Prioritized bin first
      expect(planResult.plan[0].requestQty).toBe(50);
      expect(planResult.plan[1].location.binId).toBe('BIN_B');
      expect(planResult.plan[1].requestQty).toBe(20);
      expect(planResult.totalRequestQty).toBe(70);
      console.log('✅ Correctly allocated across multiple bins');
    });

    it('should track other items in bins for validation', async () => {
      console.log('\n🧪 Testing: Keep track items for validation');
      console.log('📥 Input: Aspirin 25 units from BIN_A');

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const planResult = await (service as any)._planWithdrawal(mockUser, request.items, Date.now());

      console.log('📤 Keep Track Items:');
      console.log('  - Count:', planResult.plan[0].keepTrackItems.length);
      planResult.plan[0].keepTrackItems.forEach((item: any, index: number) => {
        console.log(`  - Item ${index + 1}: ${item.itemId} (${item.quantity} units) - LoadCell: ${item.loadcellId}`);
      });

      expect(planResult.plan[0].keepTrackItems).toHaveLength(2); // ibuprofen + vitamin
      expect(planResult.plan[0].keepTrackItems).toEqual(
        expect.arrayContaining([expect.objectContaining({ itemId: 'ibuprofen-456' }), expect.objectContaining({ itemId: 'vitamin-789' })]),
      );
      console.log('✅ Correctly tracked other items in bin');
    });

    it('should exclude requested items from keepTrackItems', async () => {
      console.log('\n🧪 Testing: Exclude requested items from tracking');
      console.log('📥 Input: Aspirin 25 + Ibuprofen 15 from BIN_A');

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 25 },
          { itemId: 'ibuprofen-456', quantity: 15 },
        ],
      };

      const planResult = await (service as any)._planWithdrawal(mockUser, request.items, Date.now());

      console.log('📤 Plan Result:');
      console.log('  - Total plans:', planResult.plan.length);
      planResult.plan.forEach((planItem: PlannedItem, index: number) => {
        console.log(`  - Plan ${index + 1}: ${planItem.itemId} x${planItem.requestQty} from ${planItem.location.binId}`);
        console.log(
          `    Keep track items (${planItem.keepTrackItems.length}):`,
          planItem.keepTrackItems.map((item) => `${item.itemId} x${item.quantity}`).join(', '),
        );
      });

      // Both items should be planned from BIN_A
      expect(planResult.plan).toHaveLength(2);

      // keepTrackItems should only contain vitamin (not aspirin or ibuprofen)
      planResult.plan.forEach((planItem: PlannedItem) => {
        expect(planItem.keepTrackItems).toEqual(expect.arrayContaining([expect.objectContaining({ itemId: 'vitamin-789' })]));
        expect(planItem.keepTrackItems).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ itemId: 'aspirin-123' }),
            expect.objectContaining({ itemId: 'ibuprofen-456' }),
          ]),
        );
      });
      console.log('✅ Correctly excluded requested items from tracking');
    });
  });

  describe('_groupPlanByBin', () => {
    it('should create single step for multiple items from same bin', () => {
      console.log('\n🧪 Testing: Group multiple items from same bin into single step');

      const mockPlan = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 25,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [{ loadcellId: 'lc-003', itemId: 'vitamin-789', binId: 'BIN_A', quantity: 20 }],
        },
        {
          itemId: 'ibuprofen-456',
          name: 'Ibuprofen',
          requestQty: 15,
          loadcellId: 'lc-002',
          location: { binId: 'BIN_A' },
          keepTrackItems: [{ loadcellId: 'lc-003', itemId: 'vitamin-789', binId: 'BIN_A', quantity: 20 }],
        },
      ];

      console.log('📥 Input Plan:');
      mockPlan.forEach((plan, index) => {
        console.log(`  - Plan ${index + 1}: ${plan.itemId} x${plan.requestQty} from ${plan.location.binId}`);
      });

      const steps = (service as any)._groupPlanByBin(mockPlan);

      console.log('📤 Generated Steps:');
      console.log('  - Total steps:', steps.length);
      console.log('  - Step 1: Bin =', steps[0].binId);
      console.log('  - Items to take:', steps[0].itemsToIssue.length);
      steps[0].itemsToIssue.forEach((item: any, index: number) => {
        console.log(`    • Item ${index + 1}: ${item.itemId} x${item.requestQty}`);
      });
      console.log('  - Keep track items:', steps[0].keepTrackItems.length);
      console.log('  - Instructions:');
      steps[0].instructions.forEach((instruction: string, index: number) => {
        console.log(`    ${index + 1}. ${instruction}`);
      });

      expect(steps).toHaveLength(1);
      expect(steps[0].binId).toBe('BIN_A');
      expect(steps[0].itemsToIssue).toHaveLength(2);
      expect(steps[0].itemsToIssue).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ itemId: 'aspirin-123', requestQty: 25 }),
          expect.objectContaining({ itemId: 'ibuprofen-456', requestQty: 15 }),
        ]),
      );
      expect(steps[0].keepTrackItems).toHaveLength(1); // Deduplicated vitamin
      console.log('✅ Successfully created single step for same-bin items');
    });

    it('should create multiple steps for items from different bins', () => {
      console.log('\n🧪 Testing: Create multiple steps for different bins');

      const mockPlan = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 50,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [],
        },
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 20,
          loadcellId: 'lc-004',
          location: { binId: 'BIN_B' },
          keepTrackItems: [],
        },
      ];

      console.log('📥 Input Plan:');
      mockPlan.forEach((plan, index) => {
        console.log(`  - Plan ${index + 1}: ${plan.itemId} x${plan.requestQty} from ${plan.location.binId}`);
      });

      const steps = (service as any)._groupPlanByBin(mockPlan);

      console.log('📤 Generated Steps:');
      console.log('  - Total steps:', steps.length);
      steps.forEach((step: any, index: number) => {
        console.log(`  - Step ${index + 1}: Bin = ${step.binId}, Qty = ${step.itemsToIssue[0].requestQty}`);
        console.log(`    Instructions: ${step.instructions.join(' → ')}`);
      });

      expect(steps).toHaveLength(2);
      expect(steps[0].binId).toBe('BIN_A');
      expect(steps[0].itemsToIssue[0].requestQty).toBe(50);
      expect(steps[1].binId).toBe('BIN_B');
      expect(steps[1].itemsToIssue[0].requestQty).toBe(20);
      console.log('✅ Successfully created multiple steps for different bins');
    });

    it('should generate correct instructions for each step', () => {
      console.log('\n🧪 Testing: Instruction generation');

      const mockPlan = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 25,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [],
        },
      ];

      const steps = (service as any)._groupPlanByBin(mockPlan);

      console.log('📤 Generated Instructions:');
      steps[0].instructions.forEach((instruction: string, index: number) => {
        console.log(`  ${index + 1}. ${instruction}`);
      });

      expect(steps[0].instructions).toEqual(['Step 1: Go to BIN_A', 'Open BIN_A', 'Take 25 units of Aspirin', 'Close BIN_A']);
      console.log('✅ Correctly generated instructions');
    });

    it('should deduplicate keepTrackItems when multiple items from same bin', () => {
      console.log('\n🧪 Testing: Deduplication of keep track items');

      const mockPlan = [
        {
          itemId: 'aspirin-123',
          name: 'Aspirin',
          requestQty: 25,
          loadcellId: 'lc-001',
          location: { binId: 'BIN_A' },
          keepTrackItems: [
            { loadcellId: 'lc-003', itemId: 'vitamin-789', binId: 'BIN_A', quantity: 20 },
            { loadcellId: 'lc-005', itemId: 'calcium-111', binId: 'BIN_A', quantity: 10 },
          ],
        },
        {
          itemId: 'ibuprofen-456',
          name: 'Ibuprofen',
          requestQty: 15,
          loadcellId: 'lc-002',
          location: { binId: 'BIN_A' },
          keepTrackItems: [
            { loadcellId: 'lc-003', itemId: 'vitamin-789', binId: 'BIN_A', quantity: 20 }, // Duplicate
            { loadcellId: 'lc-006', itemId: 'zinc-222', binId: 'BIN_A', quantity: 5 },
          ],
        },
      ];

      console.log('📥 Input Keep Track Items:');
      mockPlan.forEach((plan, planIndex) => {
        console.log(`  Plan ${planIndex + 1} (${plan.itemId}):`);
        plan.keepTrackItems.forEach((item, itemIndex) => {
          console.log(`    • ${item.itemId} x${item.quantity} (LC: ${item.loadcellId})`);
        });
      });

      const steps = (service as any)._groupPlanByBin(mockPlan);

      console.log('📤 Deduplicated Keep Track Items:');
      console.log('  - Total unique items:', steps[0].keepTrackItems.length);
      steps[0].keepTrackItems.forEach((item: any, index: number) => {
        console.log(`    • ${item.itemId} x${item.quantity} (LC: ${item.loadcellId})`);
      });

      expect(steps[0].keepTrackItems).toHaveLength(3); // Should be deduplicated
      expect(steps[0].keepTrackItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ loadcellId: 'lc-003', itemId: 'vitamin-789' }),
          expect.objectContaining({ loadcellId: 'lc-005', itemId: 'calcium-111' }),
          expect.objectContaining({ loadcellId: 'lc-006', itemId: 'zinc-222' }),
        ]),
      );
      console.log('✅ Successfully deduplicated keep track items');
    });
  });

  describe('Integration tests', () => {
    it('should handle complex scenario: mixed batch and cross-bin allocation', async () => {
      console.log('\n🧪 Testing: Complex mixed scenario');
      console.log('📥 Input: Aspirin 70 (cross-bin) + Ibuprofen 15 (same bin as first aspirin)');

      // Setup: Aspirin needs cross-bin, Ibuprofen available in same bin as first Aspirin
      repository.findItemsForIssue.mockResolvedValue(mockLoadcells);
      repository.findUserIssueHistories.mockResolvedValue(mockUserHistories);

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 70 }, // Requires BIN_A + BIN_B
          { itemId: 'ibuprofen-456', quantity: 15 }, // Available in BIN_A
        ],
      };

      const result = await service.issue(mockUser, request);
      console.log('📤 Result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(repository.findItemsForIssue).toHaveBeenCalledWith({
        itemIds: ['aspirin-123', 'ibuprofen-456'],
        expiryDate: expect.any(Number),
      });
      console.log('✅ Successfully handled complex mixed scenario');
    });

    it('should handle user with no history', async () => {
      console.log('\n🧪 Testing: User with no history');
      console.log('📥 Input: New user (no bin usage history)');

      repository.findItemsForIssue.mockResolvedValue([mockLoadcells[0]]);
      repository.findUserIssueHistories.mockResolvedValue([]); // No history

      const request: ItemRequest = {
        items: [{ itemId: 'aspirin-123', quantity: 25 }],
      };

      const result = await service.issue(mockUser, request);
      console.log('📤 Result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      // Should still work, just without bin prioritization
      console.log('✅ Successfully handled user with no history');
    });

    it('should validate that plan matches request quantities', async () => {
      console.log('\n🧪 Testing: Plan integrity validation');
      console.log('📥 Input: Multiple items with specific quantities');

      repository.findItemsForIssue.mockResolvedValue(mockLoadcells);
      repository.findUserIssueHistories.mockResolvedValue([]);

      const request: ItemRequest = {
        items: [
          { itemId: 'aspirin-123', quantity: 70 },
          { itemId: 'ibuprofen-456', quantity: 15 },
        ],
      };

      // This should not throw - quantities should match
      await expect(service.issue(mockUser, request)).resolves.toBeDefined();
      console.log('✅ Plan integrity validation passed');
    });
  });
});
