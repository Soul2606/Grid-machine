// types.ts

import type { ItemEntry, ItemInstance } from "./classes"


export type JSONValue = 
 | string
 | number
 | boolean
 | null
 | JSONValue[]
 | { [key: string]: JSONValue }
//

// A json friendly way to reference an ItemInstance (class)
export type ItemInstanceSer = {
	readonly id: string
	readonly amount: number
	readonly metadata: JSONValue
}

// Serialized snapshot of a Machine instance
export type MachineInstanceSer = {
	readonly machineId: string
	readonly stack: number
	readonly energy: number
	readonly workers: number
	readonly work: number
	readonly workingOn: readonly {amount: number, recipe: ResolvedRecipeSer}[]
}


// Game data schema
export type Item = {
	readonly id: string
	readonly name: string
	readonly tags: readonly string[]
	readonly img: string
	readonly energy?: string
}

export type Machine = {
	readonly id: string
	readonly name: string
	readonly tier: number
	readonly capabilities: readonly string[]
	readonly cost: readonly ItemInstanceSer[]
	readonly img: string
	readonly fuelNeeds?: {
		readonly tags: readonly string[],
		readonly energy: string
	}
	readonly energyNeeds?: {
		readonly voltageTier: number,
		readonly energy: string
	}
	readonly workerNeeds?: {
		readonly minimum: number,
		readonly maximum: number
	}
}

export type RecipeInput = {
	readonly amount:number
	readonly id:string
	readonly meta:JSONValue
} | {
	readonly amount:number
	readonly tag:string
	readonly meta:JSONValue
}

export type Recipe = {
	readonly id: string
	readonly inputs: readonly RecipeInput[]
	readonly outputs: readonly ItemInstanceSer[]
	readonly requiredProcess: string
	readonly requiredTier: number
	readonly processTimeSeconds: number
}

export type Extractor = {
	readonly id: string
	readonly name: string
	readonly manualPower: number
	readonly requiredPower: number
	readonly yields: Array<{
		readonly itemId: string
		readonly weight: number
	}>
}
// Game data schema end


// type represents a Recipe input slot, because multiple different items can are valid in a single input, then items is an array of Items
export type Input = {
	readonly items: readonly ItemInstance[]
	readonly amount: number
}



/*
	Type for the configuration of how the crafting algorithm should try to craft items from a given Inventory.
	If you want to cross check recipes and crafts from an inventory then it is important that all the related functions have the same crafting options otherwise they could give inconstant results.
*/
export type CraftingOptions = Readonly<{ // defaults:
	multiply?:        number              // 1
	itemPriorityList?:readonly Item[]     // []
	tagPriorityList?: readonly string[]   // []
	itemWhitelist?:   readonly Item[]     // []
	tagWhitelist?:    readonly string[]   // []
	maximize?:        true                // undefined
	capAtMax?:        true                // undefined
}>


export type ResolvedRecipeSer = Readonly<{
	id: string
	inputs: readonly ItemInstanceSer[]
	output: readonly ItemInstanceSer[]
}>
