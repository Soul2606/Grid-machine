import type { ItemEntry } from '../classes/item-entry'
import type { Item } from '../classes/item'
import type { JSONValue } from "../common/types"
import type { ItemDef } from '../game-data'


// type represents a Recipe input slot, because multiple different items can are valid in a single input, then items is an array of Items
export type Input = {
	readonly items: readonly Item[]
	readonly amount: number
}


// A recipe inside a machine instance. Dependent on environment context. Uses local uid.
export type Recipe = {
	readonly inputs:  readonly Input[]
	readonly outputs: readonly ItemEntry[]
	readonly processTimeSeconds: number
}


/*
	Type for the configuration of how the crafting algorithm should try to craft items from a given Inventory.
	If you want to cross check recipes and crafts from an inventory then it is important that all the related functions have the same crafting options otherwise they could give inconstant results.
*/
export type CraftingOptions = Readonly<{ // defaults:
	multiply?:        number              // 1
	itemPriorityList?:readonly ItemDef[]     // []
	tagPriorityList?: readonly string[]   // []
	itemWhitelist?:   readonly ItemDef[]     // []
	tagWhitelist?:    readonly string[]   // []
	maximize?:        true                // undefined
	capAtMax?:        true                // undefined
}>


// A json friendly way to reference an ItemInstance or ItemEntry
export type ItemSer = {
	readonly id: string
	readonly amount: number
	readonly metadata: JSONValue
}


export type InputSer = {
	readonly items: readonly ItemSer[]
	readonly amount: number
}


export type ResolvedRecipeSer = Readonly<{
	time: number
	inputs: readonly ItemSer[]
	output: readonly ItemSer[]
}>


export type RecipeSer = {
	readonly inputs:  readonly InputSer[]
	readonly outputs: readonly ItemSer[]
	readonly processTimeSeconds: number
}


// Serialized snapshot of a Machine instance
export type MachineSer = Readonly<{
	capableRecipes: readonly RecipeSer[];
	work:           number;
	stack:          number;
	cost:           ItemSer[];
	name:           string;
	sprite:         string;
	machineId:      string|null;
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

