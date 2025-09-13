# Business Logic

- The load-cell will be automatically registered → linked to a device at a certain point.
- Auto registration.

## Issue / Return Flow

When selecting an item to issue/return, what conditions are required and what results are expected?

- **Issue:**
    - Item type:
        - **Consumable** → issue + replenish
        - **Non-consumable** → issue + return + replenish (possible)

## Bin Operation

- Find the nearest bin → open → take item → close → move to next.

## Transaction Log

- **Cluster:**
    - Bin
    - `<Cluster Name>-<Cabinet Name>, <row>-<bin>`
    - Save input and actual state (over-picked / under-picked).
    - If exact → show **success**, if under-picked → show **warning**.

## Item Linking

- Taking an item → link it with the bin.
- `calibrationDue` + `expiryDate`: if expired → do not show in issue list.

## Working Order

- Role: optional.
- Does not affect issue/return/replenish flow.

## Condition

- Applied to group [consumable, non-issue].
- Marks the item’s state.

---

# Technical

- Maximum capacity of a system:
    - 1 cabinet → 20 bins → 20 load-cells
    - 4 ports × 24 → max **96 load-cells**
- Can the client communicate entirely via **WebSocket**?

---

# Expectations

- Issue
- Return
- Replenish
