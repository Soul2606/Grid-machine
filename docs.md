docs.md

High-level overview



Project overview

This project is a data-driven game simulation with a strict separation between:

Game configuration data

Runtime simulation logic

User interface (optional / external)

The system is designed so that the core simulation can run headlessly, without any UI, allowing deterministic testing and alternative frontends.



Folder structure

game-data/
Contains high-level game configuration.

This is the highest level of configuration in the project and defines the content of the game rather than its behavior.

All data defined here is:
- constant
- deeply immutable at runtime

They are treated as pure configuration objects and may be freely shared.



ItemInstance

Represents a specific item reference, optionally augmented with runtime state.
Properties:
- item: reference to an immutable Item
- metadata: additional runtime data
- amount: numeric quantity

Notes:
amount and metadata may be irrelevant in some contexts
amount === 0 → quantity is irrelevant
empty object metadata → metadata is irrelevant

ItemInstance is often used as an identity key, not a quantity holder



Inventory

An Inventory is conceptually just an array of ItemInstances, but with complex rules:
- per-item maximum amount
- maximum number of distinct item types
- atomic add/remove operations
- validation and invariant enforcement
- change signaling

Because these rules are non-trivial, inventory logic is encapsulated in a dedicated class rather than operating directly on arrays.

Shared Inventories

An inventory may reference other inventories as shared inventories.
Items in shared inventories are treated as available to the inventory, but are not owned by it.
Rules
Shared inventories are only allowed when:
- max === Infinity
- maxSlots === Infinity
Shared inventories are never written to directly when adding items.
Subtraction behavior
When subtracting items:
- Items are removed from the local inventory first
- Any remaining amount is removed evenly from shared inventories
- If the total available amount is insufficient, the operation fails and nothing is changed
Planning
Shared inventory logic uses a two-phase model:
- First, compute whether the operation is possible
- Then apply mutations atomically
Shared inventories model access, not ownership.



Input

Represents a single recipe input slot.
Usually used as an array of Inputs
Each Input contains an array of ItemInstances and an amount
The reason for the array of ItemInstances is  because multiple different items may satisfy a single input slot



CraftingOptions

Used to configure multiple crafting-related functions, such as:
- maxCraftableCount
- resolveCraftingCosts

If different crafting functions are invoked with different CraftingOptions, they may disagree about the same state.
Correct usage requires that all related crafting operations share the same options instance.



MachineInstance

Responsible for simulating machines and recipe processing.
Characteristics:
- operates purely on data
- no UI dependencies
- deterministic simulation
- suitable for headless execution

This allows the same simulation to be run:
- inside the main UI
- in a separate HTML file
- in automated tests



Technical notes:
The term Item is a misnomer in this project. Resource is the more accurate term. Wherever Item appears in code or documentation, it should be understood as referring to a Resource.

Sometimes different function can disagree on the truth of the same state, in that case: Prediction functions are advisory; execution functions are authoritative.

resolveCraftingCosts is a super important function, it is responsible for taking huge amount of data and turn that into a definitive set of items that can be used to satisfy the provided recipe.
