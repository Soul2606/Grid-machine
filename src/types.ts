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

// A json friendly way to reference an ItemInstance or ItemEntry
export type ItemInstanceSer = {
	readonly id: string
	readonly amount: number
	readonly metadata: JSONValue
}

// Serialized snapshot of a Machine instance
export type MachineInstanceSer = Readonly<{
	capableRecipes: readonly Recipe[];
	work: number;
	stack: number;
	cost: ItemInstanceSer[];
	workingOn: {
		readonly amount: number;
		readonly recipe: ResolvedRecipeSer;
	}[];
	workerNeed: {
		readonly minimum: number;
		readonly maximum: number;
		workers: number;
	} | undefined;
	fuelNeed: {
		readonly need: number;
		readonly tags: readonly string[];
		energy: number;
	} | undefined;
	powerNeed: {
		readonly need: number;
		readonly voltageTier: number;
		energy: number;
	} | undefined;
}>


// Game data 
export type Item = {
	readonly id: string
	readonly name: string
	readonly formula: string
	readonly description: string
	readonly tags: readonly string[]
	readonly img: string
	readonly energy: string | undefined
}

export type Machine = {
	readonly id: string
	readonly name: string
	readonly tier: number
	readonly capabilities: readonly string[]
	readonly cost: readonly ItemInstanceSer[]
	readonly img: string
	readonly fuelNeeds: {
		readonly tags: readonly string[],
		readonly energy: string
	} | undefined
	readonly energyNeeds: {
		readonly voltageTier: number,
		readonly energy: string
	} | undefined
	readonly workerNeeds: {
		readonly minimum: number,
		readonly maximum: number
	} | undefined
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
// Game data end


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
