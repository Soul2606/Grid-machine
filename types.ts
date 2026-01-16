// types.ts
export type Item = {
	id: string
	name: string
	tags: string[]
}

export type Machine = {
	id: string
	name: string
	tier: number
	requiresConfiguration: boolean
}

export type Recipe = {
	id: string
	inputs: any[]
	outputs: any[]
	requiredProcess: string
	requiredTier: number
	processTimeSeconds: number
}

export type Extraction = {
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
