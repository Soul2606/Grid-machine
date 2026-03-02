# Documentation
## Project overview

This project is a data-driven game simulation with a strict separation between:

- Game configuration data.
- Runtime simulation logic.
- User interface (optional / external).

The system is designed so that the core simulation can run headlessly, without any UI, allowing the user to switch between different html files while the simulation runs in the background from a universal script file.

It is possible to keep the state of the game when moving between different html files. Thats why many of the classes and types can be serialized.

One of the big selling points of this game is the ability to connects machines together. There is two ways to do this: Processing lines and Factories.

### Processing line

Is a linear line of machine instances where the output of one machine routes to the input of the next machine. A machine line can only be built if every possible output can be routed without *ambiguity* (further details in the code). 

Processing lines allow recipes to be compressed into 1 and allow for basic automation. 

### Factories

Factories ar much simpler but much more powerful. Here everything is defined and every route is built by the user, this allows a factory to contain super complex chains of machines that can preform any recipe chain. The most powerful thing about Factories is that they can be compiled into a single process making them super performant. 

Because factories act so similar to machines, they can used inside factories, creating a potentially infinite recursions of factories within factories that has not performance impact because pf the compilation. This has a limit: compiling a factory is not reversible, so the factory has to remember its internal graph of machines and recipes. This is the limiting factor becaus you will eventually run out of memory.

## Code Structure
Below is an overview of classes, types, modules and the higher level architecture of the codebase.

### Game Data
---
The folder **game-data** contains game configuration. This is the highest level of configuration in the project and defines the **content of the game** rather than its behavior.

All data defined here is:
- Constant.
- Deeply immutable at runtime.

They are usually fetched and stored as global variables in whatever module they are used in.

#### Extraction, Items
These types form the Fixed Ontology (Non‑Customizable) of the game world.
They define the fundamental building blocks of the universe and cannot be extended or modified at runtime.

- **Items** describe the canonical object types that can exist. Runtime item instances reference these definitions by id.

- **Extraction** describes the canonical extraction sources or extraction rules. Like Items, they are static and globally referenced.

Both are immutable facts about the world, not behavior.

#### Recipes
Recipes describe what is theoretically possible, not what is currently happening.
They define abstract conversions between items (inputs, outputs, time).

They are not tied to any machine and should not be used to describe recipes in progress or recipes chosen.
That is delegated to the **Resolved Recipe** class.

#### Machines
This type describe the blueprint for the default machines in the game. Machine Instances are not tied to the Machine type at all and custom machines can be built at runtime.

### ItemInstance "Class"
---
Represents a specific item reference. It is used as an identity key since it includes metadata unlike the **Item** type. This class is tightly coupled to the **Item** type, this class acts like a wrapper for **Item**. 

Notes:
- Can be serialized.

### ItemEntry "Class"
---
Represents a specific item reference and quantity. It is used as an identity key and quantity holder.

Notes:
- Can be serialized.

### Inventory "Class"
---
Inventory represents the universal item‑holding abstraction in the simulation. It provides a consistent interface for machines, factories, and player storage, and guarantees that all item movement respects global invariants.

### Input "Type"
---
Represents a single recipe input slot.
Usually used as an array of Inputs.

The reason for the array of **ItemInstances** is because multiple different items may satisfy a single input slot.

Notes:
- Can be serialized.

### CraftingOptions "Type"
---
Used to configure multiple crafting-related functions.

If different crafting functions are invoked with different **CraftingOptions**, they might disagree about the same state.
Correct usage requires that all related crafting operations share the same options instance.

### MachineInstance "Class"
---
Responsible for simulating machines and recipe processing. It is not tied to **Machine** at all, **Machine** is a schematic for creating a **MachineInstance**. 

Characteristics:
- Operates purely on data.
- Deterministic simulation.

This allows the same simulation to be run:
- Inside the main UI.
- In a separate HTML file.

### ResolvedRecipe "Class"
---
ResolvedRecipe (“rr”) is a fully resolved, atomic execution of a single recipe. Used as a recipe in process. 

Notes:
- Atomic: Represents one execution only.
- Irreversible: Cannot reconstruct the source recipe batch.
- Equal **rr**s can be stacked to save on memory.
- Can be serialized.

## Technical notes:
The term **Item** is not entirely accurate as represents real life objects that might not fall under the category "item" such as liquids, gasses or energy. Resource is the more accurate term, but its still not perfect. Regardless **Item** is the chosen name.

Sometimes different function can disagree on the truth of the same state, in that case: Prediction functions are advisory; execution functions are authoritative. All execution functions should return enough data that any script from the outside can know exactly what happened. 

**resolveCraftingCosts** is a super important function, it is responsible for taking huge amount of data and turn that into a definitive set of items that can be used to satisfy the provided recipe.
