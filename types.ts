// types.ts
export type Item = {
	id: string
	name: string
	tags: string[]
	energy?: string
}

export type Machine = {
	id: string
	name: string
	tier: number
	requiresConfiguration: boolean
	capabilities: string[]
	fuelNeeds?: {
		tags: string[],
		energy: string
	}
	energyNeeds?: {
		voltageTier: number,
		energy: string
	}
}

export type RecipeIO = {
	id?:string
	tag?:string
	amount:number
}

export type Recipe = {
	id: string
	inputs: RecipeIO[]
	outputs: RecipeIO[]
	requiredProcess: string
	requiredTier: number
	processTimeSeconds: number
}

export type Extractor = {
	id: string
	name: string
	manualPower: number
	requiredPower: number
	yields: Array<{
		itemId: string
		weight: number
	}>
}

export type ItemEntry = {
	item: Item
	amount: number
}

export type Input = {
	items: Item[]
	amount: number
}

// brand type
export type Craftable = (Item|Machine) & { readonly __brand_craftable?: unique symbol }


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
