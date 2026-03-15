// =============== NO IMPORT (except types) ================
import type { Extractor, Item, ItemInstanceSer, JSONValue, Machine, Recipe } from "./types"

type Data = Readonly<{
	items:readonly Item[],
	machines:readonly Machine[],
	recipes:readonly Recipe[],
	extractors:readonly Extractor[]
}>


type ItemSchema = Record<
	string,
	{
		name: string
		tags?: string[]
		img?: string
		energy?: string
	}
>


type RecipeSchemaInput = {
	id:string
	amount:number
	meta?:JSONValue
} | {
	tag:string
	amount:number
	meta?:JSONValue
}

type RecipeSchema = {
	id:string
	inputs:RecipeSchemaInput[]
	outputs:{id:string, amount:number, meta?:JSONValue}[]
	requiredProcess:string
	requiredTier?:number
	processTimeSeconds?:number
}


type MachineSchema = Record<string, {
	readonly id: string
	readonly name: string
	readonly tier: number
	readonly capabilities: readonly string[]
	readonly cost: readonly {id:string, amount:number, meta?:JSONValue}[]
	readonly img?: string
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
}>


type ExtractorSchema = Record<string, {
	name:string
	manualPower?:number
	requiredPower:number
	yields:{
		itemId:string
		weight?:number
	}[]
}>




function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false
	if (Array.isArray(value)) return false

	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}


function isArray(v: unknown): v is unknown[] {
	return Array.isArray(v)
}



async function fetchData(){
	
	async function fetchJSON(url: string) {
		return fetch(url).then(response => {
			if (!response.ok) {
				throw new Error("Network response was not ok" + response.statusText)

			}
			return response.json()
		})
	}

	function compile(items: unknown, machines: unknown, recipes: unknown, extraction: unknown) {

		if (!isPlainObject(items)) throw new Error("items is not an object")
		if (!isPlainObject(machines)) throw new Error("machines is not an object")
		if (!isArray(recipes)) throw new Error("recipes is not an array")
		if (!isPlainObject(extraction)) throw new Error("extractors is not an object")


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

		type Types = "string" | "number" | "boolean" 
		/** Check primitive type */
		const pt = (obj: any, type: Types|Types[], optional?: true) => {
			if (optional && obj === undefined) return
			const TYPE = [type].flat()
			const valid = TYPE.some(type => 
				typeof obj === type
			)
			if (!valid) throw new Error(`${obj} is not of type ${JSON.stringify(TYPE)}`)
		}

		for (const key in items) {
			const item = items[key]
			if (!isPlainObject(item)) throw new Error("Item must be a plain object");
			if(isArray(item.tags)){
				item.tags.forEach((tag: any) => pt(tag, 'string'))
			}
			pt(item.name, 'string')
			pt(item.img, "string", true)
		}

		for (const key in machines) {
			const machine = machines[key]
			if (!isPlainObject(machine)) throw new Error("Machine is not an object");
			pt(machine.name, 'string')
			pt(machine.tier, 'number')
			if (isArray(machine.cost)) {				
				for (const cost of machine.cost) {
					if (!isPlainObject(cost)) throw new Error("Machine cost is not an array of objects");
					pt(cost.id, "string")
					pt(cost.amount, "number")
				}
			}
			if (isArray(machine.capabilities)) {
				machine.capabilities.forEach(item => 
					pt(item, 'string')
				)
			}
			pt(machine.img, "string", true)
			if (machine.fuelNeeds) {
				if (!isPlainObject(machine.fuelNeeds)) throw new Error("fuel needs is not an object");
				if (!isArray(machine.fuelNeeds.tags)) throw new Error("fuel needs tag is not an array");
				machine.fuelNeeds.tags.forEach(v => pt(v, 'string'))
				pt(machine.fuelNeeds.energy, 'string')
			}
			if (machine.energyNeeds) {
				if (!isPlainObject(machine.energyNeeds)) throw new Error("energy needs is not an object");
				pt(machine.energyNeeds.voltageTier, 'number')
				pt(machine.energyNeeds.energy, 'string')
			}
		}

		for (const recipe of recipes) {
			if (!isPlainObject(recipe)) throw new Error("recipe is not a plain object");
			pt(recipe.id, 'string')
			pt(recipe.requiredProcess, 'string')
			pt(recipe.requiredTier, 'number')
			pt(recipe.processTimeSeconds, 'number')
			if (!isArray(recipe.inputs)) throw new Error("inputs is not an array");
			for(const input of recipe.inputs){
				if (!isPlainObject(input)) throw new Error("input is not an object");
				pt(input.amount, 'number')
				if ("id" in input) {
					pt(input.id, 'string')
				} else {
					pt(input.tag, 'string')
				}
			}
			if (!isArray(recipe.outputs)) throw new Error("outputs is not an array");
			for (const output of recipe.outputs){
				if (!isPlainObject(output)) throw new Error("output is not an object");
				pt(output.id, 'string')
				pt(output.amount, 'number')
			}
		}


		for (const key in extraction) {
			if (!Object.hasOwn(extraction, key)) continue;
			const ext = extraction[key];
			if (!isPlainObject(ext)) throw new Error("extractor is not an object");
			pt(ext.name, "string")
			pt(ext.manualPower, "number", true)
			pt(ext.requiredPower, "number")
			if (!isArray(ext.yields)) throw new Error("yields is not an array");
			for (const y of ext.yields) {
				if (!isPlainObject(y)) throw new Error("yield is not an object");
				pt(y.itemId, "string")
				pt(y.weight, "number", true)
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
			const result = hasDuplicateIds(Object.keys(items).concat(Object.keys(machines)))
			if (result) throw new Error(`Machines and Items has duplicate IDs, ${result}`)
		}
		{
			const result = hasDuplicateIds(recipes.map((r:any) => r.id))
			if (result) throw new Error(`Recipes has duplicate IDs, ${result}`)
		}
		return { 
			items: Object.entries(items as ItemSchema).map(([key, value]) =>{
				const item = {
					...value,
					id:key
				}
				return {
					id: item.id,
					name: item.name,
					tags: item.tags ?? [],
					img: item.img ?? "",
					energy:item.energy 
				}
			}),
			machines: Object.entries(machines as MachineSchema).map(([key, value]) => {
				const machine = {
					...value,
					id:key
				}
				return {
					id:machine.id,
					name:machine.name,
					tier:machine.tier,
					capabilities:machine.capabilities,
					img:machine.img??"",
					cost:machine.cost.map(item => ({
						id:item.id,
						amount:item.amount,
						metadata: item.meta??null
					})),
					fuelNeeds:  machine.fuelNeeds,
					energyNeeds:machine.energyNeeds,
					workerNeeds:machine.workerNeeds,
				}
			}
			),
			recipes: (recipes as RecipeSchema[]).map(r => ({
				id:r.id,
				inputs:r.inputs.map(i=>("id" in i ? {id:i.id, amount:i.amount, meta:i.meta??null} : {tag:i.tag, amount:i.amount, meta:i.meta??null})),
				outputs:r.outputs.map(i=>({id:i.id, amount:i.amount, metadata:i.meta??null})),
				requiredProcess: r.requiredProcess,
				requiredTier: r.requiredTier??0,
				processTimeSeconds: r.processTimeSeconds??0
			} satisfies Recipe)),
			extractors:Object.entries(extraction as ExtractorSchema).map(([key,value]) => ({
				id:key,
				name:value.name,
				manualPower:value.manualPower??0,
				requiredPower:value.requiredPower,
				yields:value.yields.map(y => ({itemId:y.itemId, weight:y.weight??1}))
			}))
		} satisfies Data
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
	recipes: new Map<string, Recipe>(data.recipes.map(recipe=>
		([recipe.id, recipe])
	)),
	extractors: data.extractors // Does not have id
})



