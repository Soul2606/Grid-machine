# Documentation
## Project overview

This project is a data-driven game simulation with a strict separation between:

- Game configuration data.
- Runtime simulation logic.
- User interface (optional / external).

The system is designed so that the core simulation can run headlessly, without any UI, allowing the user to switch between different html files while the simulation runs in the background from a universal script file

## Code Structure
Below is an overview of classes, types, modules and the higher level architecture of the codebase.

### Game Data
---
The folder **game-data** contains game configuration. This is the highest level of configuration in the project and defines the **content of the game** rather than its behavior.

All data defined here is:
- Constant.
- Deeply immutable at runtime.

They are usually fetched and stored as global variables in whatever module they are used in.

#### Recipes, Extraction, Machines
These have no class tied to them, that means no class directly contain them but some classes can be constructed based on them. They can be used as a schematic for constructing classes and objects. Or used as config data.

These allow for custom content.

#### Items
This type has a corresponding runtime classes that is coupled to it. Equality can be determined via the shared **id**.

Content is limited.

### ItemInstance "Class"
---
Represents a specific item reference. It is used as an identity key since it includes metadata unlike the **Item** type.

Properties:
- item: reference to an immutable **Item**.
- metadata: additional runtime data as **JSON**.

Notes:
- Metadata is important for equality, if two item instances have different metadata then they are not equal.
- Can be serialized.

### ItemEntry "Class"
---
Extends ItemInstance.

Represents a specific item reference and quantity. It is used as an identity key and quantity holder.

Additional properties:
- amount: number

Notes:
- Can be serialized.

### Inventory "Class"
---
An Inventory is conceptually just an array of **ItemInstances**, but with complex rules:
- per-item maximum amount
- maximum number of distinct item types
- atomic add/remove operations
- validation and invariant enforcement
- change signaling

Because these rules are non-trivial, inventory logic is encapsulated in a dedicated class rather than operating directly on arrays.

### Input "Type"
---
Represents a single recipe input slot.
Usually used as an array of Inputs.
Each Input contains an array of **ItemInstances** and an **amount**.

The reason for the array of **ItemInstances** is because multiple different items may satisfy a single input slot.

Notes:
- Can be serialized.

### CraftingOptions "Type"
---
Used to configure multiple crafting-related functions, such as:
- maxCraftableCount
- resolveCraftingCosts

If different crafting functions are invoked with different **CraftingOptions**, they may disagree about the same state.
Correct usage requires that all related crafting operations share the same options instance.

### MachineInstance "Class"
---
Responsible for simulating machines and recipe processing. It is not tied to **Machine** at all, **Machine** is a schematic for creating a **MachineInstance**.

Characteristics:
- Operates purely on data.
- No UI dependencies.
- Deterministic simulation.
- Suitable for headless execution.

This allows the same simulation to be run:
- Inside the main UI.
- In a separate HTML file.
- In automated tests.

### ResolvedRecipe "Class"
---
**"rr"** for short. Represents a fully resolved, atomic execution of a single recipe.

Notes:
- Atomic: Represents one execution only.
- Irreversible: Cannot reconstruct the source recipe batch.
- Designed for inventory mutation and machine execution.
- Equal **rr**s can be stacked to save on memory.
- Can be serialized.

## Technical notes:
The term **Item** is not entirely accurate as represents real life objects that might not fall under the category "item" such as liquids, gasses or energy. Resource is the more accurate term, but its still not perfect. Regardless **Item** is the chosen name.

Sometimes different function can disagree on the truth of the same state, in that case: Prediction functions are advisory; execution functions are authoritative. All execution functions should return enough data that any script from the outside can know exactly what happened. 

**resolveCraftingCosts** is a super important function, it is responsible for taking huge amount of data and turn that into a definitive set of items that can be used to satisfy the provided recipe.
