// =============== NO IMPORT (except types) ================
import type { Extractor, Item, Machine, Recipe } from "./types"

type Data = Readonly<{
	items:readonly Item[],
	machines:readonly Machine[],
	recipes:readonly Recipe[],
	extractors:readonly Extractor[]
}>


async function fetchData(){
	
	async function fetchJSON(url: string) {
		return fetch(url).then(response => {
			if (!response.ok) {
				throw new Error("Network response was not ok" + response.statusText)

			}
			return response.json()
		})
	}

	function compile(items: Record<string, unknown>, machines: Record<string, unknown>, recipes: unknown, extraction: unknown) {

		if (typeof items !== "object" || items === null) throw new Error("error")
		if (typeof machines !== "object" || machines === null) throw new Error("error")
		if (!Array.isArray(recipes)) throw new Error("error")
		if (!Array.isArray(extraction)) throw new Error("error")


		const limitKeysTo = (obj: any, keys: string[]) => {
			if (Object.keys(obj).some(key => !keys.includes(key))) throw new Error(`${obj.id} has invalid keys, object can only have these keys:${keys}`)
		}

		const includeKeys = (obj: any, keys: string[]) => {
			if (keys.some(key => !Object.keys(obj).includes(key))) throw new Error(`${obj.id} has invalid keys, object must include these keys:${keys}`)
		}

		Object.values(items).forEach(item => {
			includeKeys(item, ['name', 'tags'])
		})

		Object.values(machines).forEach(item => {
			includeKeys(item, ['name', 'capabilities', 'tier', "cost"])
		})
		Object.values(machines).forEach(item => {
			limitKeysTo(item, ['name', 'capabilities', 'tier', "cost", "img", 'energyNeeds', 'fuelNeeds', "workerNeeds"])
		})

		recipes.forEach(item => {
			limitKeysTo(item, ['id', 'inputs', 'outputs', 'requiredProcess', 'requiredTier', 'processTimeSeconds'])
		})

		type Types = "string" | "number" | "boolean" | "array" | "object"
		const ct = (obj: any, type: Types|Types[], optional?: true) => {
			if (optional && obj === undefined) return
			const TYPE = [type].flat()
			const valid = TYPE.some(type => {
				if (type === 'array') {
					return Array.isArray(obj)
				}
				return typeof obj === type
			})
			if (!valid) throw new Error(`${obj} is not of type ${JSON.stringify(TYPE)}`)
		}

		for (const key in items) {
			const item: any = items[key]
			ct(item.name, 'string')
			ct(item.tags, 'array')
			ct(item.img, "string", true)
			item.tags.forEach((tag: any) => ct(tag, 'string'))
		}

		for (const key in machines) {
			const machine:any = machines[key]
			ct(machine.name, 'string')
			ct(machine.tier, 'number')
			ct(machine.cost, "array")
			for (const cost of machine.cost) {
				ct(cost.id, "string")
				ct(cost.amount, "number")
			}
			ct(machine.capabilities, 'array')
			machine.capabilities.forEach((item: any) => ct(item, 'string'))
			ct(machine.img, "string", true)
			if (machine.fuelNeeds) {
				ct(machine.fuelNeeds.tags, 'array')
				machine.fuelNeeds.tags.forEach((v: any) => ct(v, 'string'))
				ct(machine.fuelNeeds.energy, 'string')
			}
			if (machine.energyNeeds) {
				ct(machine.energyNeeds.voltageTier, 'number')
				ct(machine.energyNeeds.energy, 'string')
			}
		}

		for (const recipe of recipes) {
			ct(recipe.id, 'string')
			ct(recipe.requiredProcess, 'string')
			ct(recipe.requiredTier, 'number')
			ct(recipe.processTimeSeconds, 'number')
			ct(recipe.inputs, 'array')
			for(const input of recipe.inputs){
				limitKeysTo(input, ['id', 'tag', 'amount'])
				ct(input.id, 'string', true)
				ct(input.tag, 'string', true)
				ct(input.amount, 'number')
			}
			ct(recipe.outputs, "array")
			for (const output of recipe.outputs){
				limitKeysTo(output, ['id', 'tag', 'amount'])
				ct(output.id, 'string', true)
				ct(output.tag, 'string', true)
				ct(output.amount, 'number')
			}
		}


		const hasDuplicateIds = (array: string[]) => {
			const previousIds = new Set<string>()
			const duplicates = new Set<string>()
			for (const str of array) {
				if (previousIds.has(str)) duplicates.add(str)
				previousIds.add(str)
			}
			return duplicates.size === 0 ? false : duplicates
		}
		{
			const result = hasDuplicateIds(Object.keys(items).concat(Object.keys(machines).map(id => id)))
			if (result) throw new Error(`Machines and Items has duplicate IDs, ${result}`)
		}
		{
			const result = hasDuplicateIds(recipes)
			if (result) throw new Error(`Recipes has duplicate IDs, ${result}`)
		}
		return { 
			items: Object.keys(items).map(key =>
				//@ts-ignore
				({...items[key], id:key})
			),
			machines: Object.keys(machines).map(key =>
				//@ts-ignore
				({...machines[key], id:key})
			),
			recipes,
			extractors:extraction
		} as Data
	}
	const items = await fetchJSON('src/game-data/items.json')
	const machines = await fetchJSON('src/game-data/machines.json')
	const recipes = await fetchJSON('src/game-data/recipes.json')
	const extraction = await fetchJSON('src/game-data/extraction.json')
	return compile(items, machines, recipes, extraction)
}


const data = await fetchData()


export const getData = ()=>data


export const getDataMapToId = ()=>({
	items: new Map<string,Item>(data.items.map(item=>
		([item.id, item])
	)) as ReadonlyMap<string, Item>,
	machines: new Map<string, Machine>(data.machines.map(machine=>
		([machine.id, machine])
	)) as ReadonlyMap<string, Machine>,
	recipes: data.recipes,
	extractors: data.extractors
})



