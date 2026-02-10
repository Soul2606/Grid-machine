docs.md

High-level overview



Project overview

This project is a data-driven game simulation with a strict separation between:

Game configuration data

Runtime simulation logic

User interface (optional / external)

The system is designed so that the core simulation can run headlessly, without any UI, allowing the user to switch between different html files while the simulation runs in the background from a universal script file



Folder structure

game-data/
Contains high-level game configuration.

This is the highest level of configuration in the project and defines the content of the game rather than its behavior.

All data defined here is:
- constant
- deeply immutable at runtime

They are treated as pure configuration objects and may be freely shared.



ItemInstance

Represents a specific item reference.
Properties:
- item: reference to an immutable Item
- metadata: additional runtime data

Notes:
metadata is important for equality, if two item instances have different metadata then they are not equal

ItemInstance is often used as an identity key



ItemEntry

extends ItemInstance
Represents a specific item reference and quantity.
Additional properties
- amount: number

ItemEntry is used as an identity key and quantity holder



Inventory

An Inventory is conceptually just an array of ItemInstances, but with complex rules:
- per-item maximum amount
- maximum number of distinct item types
- atomic add/remove operations
- validation and invariant enforcement
- change signaling

Because these rules are non-trivial, inventory logic is encapsulated in a dedicated class rather than operating directly on arrays.



Input

Represents a single recipe input slot.
Usually used as an array of Inputs
Each Input contains an array of ItemInstances and an amount
The reason for the array of ItemInstances is  because multiple different items may satisfy a single input slot



Output

Represents every output of a single recipe
It has two types
- type: "machine"
- type: "items"

That is because a recipe can either output a set of items or a single machine, never both.



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



ResolvedRecipe
rr for short
Represents a fully resolved, atomic execution of a single recipe.
Notes:
- Atomic: Represents one execution only
- Irreversible: Cannot reconstruct the source recipe batch
- Designed for inventory mutation and machine execution.
- Equal rrs can be stacked to save on memory



Technical notes:
The term Item is a misnomer in this project. Resource is the more accurate term. Wherever Item appears in code or documentation, it should be understood as referring to a Resource.

Sometimes different function can disagree on the truth of the same state, in that case: Prediction functions are advisory; execution functions are authoritative.

resolveCraftingCosts is a super important function, it is responsible for taking huge amount of data and turn that into a definitive set of items that can be used to satisfy the provided recipe.
