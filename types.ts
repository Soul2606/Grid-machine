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
