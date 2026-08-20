// =============== NO IMPORT (except types) ================
import type { ItemSer } from "./crafting-system/types"
import type { JSONValue } from "./common/types"
import { validate, type Config } from "./lib/data/json/validator.js";

type Data = Readonly<{
	items:readonly ItemDef[],
	machines:readonly MachineDef[],
	recipes:readonly RecipeDef[],
	extractors:readonly ExtractorDef[]
}>


type ItemSchema = Record<
	string,
	{
		name: string
		formula?: string
		description?: string
		tags?: string[]
		img?: string
		energy?: string
	}
>

const itemSchema:Config = {
	type:"record",
	match:{
		type:"obj",
		match:{
			name: {type:"str"},
			formula: {type:"str", option:true},
			description: {type:"str", option:true},
			tags: {
				type:"arr",
				match:{type:"str"}
			},
			img: {type:"str"},
			energy: {type:"str"},
		}
	}
}


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
	id?:string
	inputs:RecipeSchemaInput[]
	outputs:{id:string, amount:number, meta?:JSONValue}[]
	requiredProcess:string
	requiredTier?:number
	processTimeSeconds?:number
}[]

const recipeSchema:Config = {
	type:"arr",
	match:{
		type:"obj",
		match:{
			id:{type:"str"},
			inputs:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						id:{type:"str"},
						amount:{type:"num"},
						meta:{type:"any", option:true}
					}
				}
			},
			outputs:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						id:{type:"str"},
						amount:{type:"num"},
						meta:{type:"any", option:true},
					}
				}
			},
			requiredProcess:{type:"str"},
			requiredTier:{type:"num", option:true},
			processTimeSeconds:{type:"num", option:true},
		}
	}
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

const machineSchema:Config = {
	type:"record",
	match:{
		type:"obj",
		match:{
			id:{type:"str"},
			name:{type:"str"},
			tier:{type:"num"},
			capabilities:{
				type:"arr",
				match:{type:"str"}
			},
			cost:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						id:{type:"str"},
						amount:{type:"num"},
						meta:{type:"any", option:true}
					}
				}
			},
			img:{type:"str", option:true},
			fuelNeeds:{
				type:"obj",
				option:true,
				match:{
					tags: {type:"arr", match:{type:"str"}},
					energy: {type:"str"}
				}
			},
			energyNeeds:{
				type:"obj",
				option:true,
				match:{
					voltageTier: {type:"num"},
					energy: {type:"str"}
				}
			},
			workerNeeds:{
				type:"obj",
				option:true,
				match:{
					minimum:{type:"num"},
					maximum:{type:"num"}
				}
			}
		}
	}
}


type ExtractorSchema = Record<string, {
	name:string
	manualPower?:number
	requiredPower:number
	yields:{
		itemId:string
		weight?:number
	}[]
}>

const extractorSchema:Config = {
	type:"record",
	match:{
		type:"obj",
		match:{
			name:{type:"num"},
			manualPower:{type:"num", option:true},
			requiredPower:{type:"num"},
			yields:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						itemId:{type:"str"},
						weight:{type:"num"}
					}
				}
			}
		}
	}
}




async function fetchJSON<T = any>(url: string): Promise<T> {
	return fetch(url).then(response => {
		if (!response.ok) {
			throw new Error("Network response was not ok" + response.statusText)

		}
		return response.json()
	})
}


async function fetchData():Promise<Data> {
	const items = await fetchJSON<ItemSchema>('game-data/items.json')
	const machines = await fetchJSON<MachineSchema>('game-data/machines.json')
	const recipes = await fetchJSON<RecipeSchema>('game-data/recipes.json')
	const extraction = await fetchJSON<ExtractorSchema>('game-data/extraction.json')
	validate(items, itemSchema)
	validate(machines as any, machineSchema)
	validate(recipes, recipeSchema)
	validate(extraction, extractorSchema)
	return { 
		items: Object.entries(items as ItemSchema).map(([key, value]) =>{
			const item = {
				...value,
				id:key
			}
			return {
				id: item.id,
				name: item.name,
				formula: item.formula ?? "",
				description: item.description ?? "",
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
		recipes: (recipes as RecipeSchema).map((r,i) => ({
			id:r.id??"v-"+i,
			inputs:r.inputs.map(i=>("id" in i ? {id:i.id, amount:i.amount, meta:i.meta??null} : {tag:i.tag, amount:i.amount, meta:i.meta??null})),
			outputs:r.outputs.map(i=>({id:i.id, amount:i.amount, metadata:i.meta??null})),
			requiredProcess: r.requiredProcess,
			requiredTier: r.requiredTier??0,
			processTimeSeconds: r.processTimeSeconds??0
		} satisfies RecipeDef)),
		extractors:Object.entries(extraction as ExtractorSchema).map(([key,value]) => ({
			id:key,
			name:value.name,
			manualPower:value.manualPower??0,
			requiredPower:value.requiredPower,
			yields:value.yields.map(y => ({itemId:y.itemId, weight:y.weight??1}))
		}))
	} satisfies Data
}


const data = await fetchData()


export const getData = ()=>data


export const getDataMapToId = ()=>({
	items: new Map<string,ItemDef>(data.items.map(item=>
		([item.id, item])
	)) as ReadonlyMap<string, ItemDef>,
	machines: new Map<string, MachineDef>(data.machines.map(machine=>
		([machine.id, machine])
	)) as ReadonlyMap<string, MachineDef>,
	recipes: new Map<string, RecipeDef>(data.recipes.map(recipe=>
		([recipe.id, recipe])
	)),
	extractors: data.extractors // Does not have id
})
// ========= Game data =========




export type ItemDef = {
	readonly id: string
	readonly name: string
	readonly formula: string
	readonly description: string
	readonly tags: readonly string[]
	readonly img: string
	readonly energy: string | undefined
}

export type MachineDef = {
	readonly id: string
	readonly name: string
	readonly tier: number
	readonly capabilities: readonly string[]
	readonly cost: readonly ItemSer[]
	readonly img: string
	readonly fuelNeeds: {
		readonly tags: readonly string[]
		readonly energy: string
	} | undefined
	readonly energyNeeds: {
		readonly voltageTier: number
		readonly energy: string
	} | undefined
	readonly workerNeeds: {
		readonly minimum: number
		readonly maximum: number
	} | undefined
}

type RecipeInput = {
	readonly amount: number
	readonly id: string
	readonly meta: JSONValue
} | {
	readonly amount: number
	readonly tag: string
	readonly meta: JSONValue
}

export type RecipeDef = {
	readonly id: string
	readonly inputs: readonly RecipeInput[]
	readonly outputs: readonly ItemSer[]
	readonly requiredProcess: string
	readonly requiredTier: number
	readonly processTimeSeconds: number
}

export type ExtractorDef = {
	readonly id: string
	readonly name: string
	readonly manualPower: number
	readonly requiredPower: number
	readonly yields: Array<{
		readonly itemId: string
		readonly weight: number
	}>
}



