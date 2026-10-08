// =============== NO IMPORT (except types) ================
import type { ItemEntry } from "./classes/item-entry.js";
import type { JSONValue } from "./common/types"
import { validate, type Config, type ConfType } from "./lib/data/json/validator.js";

type Data = Readonly<{
	items:readonly ItemDef[],
	machines:readonly MachineDef[],
	recipes:readonly RecipeDef[],
	extractors:readonly ExtractorDef[]
}>


const itemSchema = {
	type:"record",
	match:{
		type:"obj",
		match:{
			name: "str",
			formula: "str",
			description: "str",
			tags: {
				type:"arr",
				match:"str"
			},
			img: "str",
			energy: "str",
		},
		optional:[
			"formula",
			"description",
			"tags",
			"img",
			"energy"
		]
	}
} as const satisfies Config

type ItemSchema = ConfType<typeof itemSchema>



const recipeSchema = {
	type:"arr",
	match:{
		type:"obj",
		match:{
			id:"str",
			inputs:{
				type:"arr",
				match:{
					type:"union",
					match:[
						{
							type:"obj",
							match:{
								id:"str",
								amount:"num",
							}
						},
						{
							type:"obj",
							match:{
								tag:"str",
								amount:"num",
							}
						}
					]
				}
			},
			outputs:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						id:"str",
						amount:"num",
					}
				}
			},
			requiredProcess:"str",
			requiredTier:"num",
			processTimeSeconds:"num",
		},
		optional:[
			"id",
			"requiredTier",
			"processTimeSeconds"
		]
	}
} as const satisfies Config

type RecipeSchema = ConfType<typeof recipeSchema>


const machineSchema = {
	type:"record",
	match:{
		type:"obj",
		optional:[
			"img",
			"fuelNeeds",
			"energyNeeds",
			"workerNeeds"
		],
		match:{
			name:"str",
			tier:"num",
			capabilities:{
				type:"arr",
				match:"str"
			},
			cost:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						id:"str",
						amount:"num",
					}
				}
			},
			img:"str",
			fuelNeeds:{
				type:"obj",
				match:{
					tags: {type:"arr", match:"str"},
					energy: "str"
				}
			},
			energyNeeds:{
				type:"obj",
				match:{
					voltageTier:"num",
					energy:"str"
				}
			},
			workerNeeds:{
				type:"obj",
				match:{
					minimum:"num",
					maximum:"num"
				}
			}
		}
	}
} as const satisfies Config

type MachineSchema = ConfType<typeof machineSchema>


const extractorSchema = {
	type:"record",
	match:{
		type:"obj",
		optional:[
			"manualPower"
		],
		match:{
			name:"str",
			manualPower:"num",
			requiredPower:"num",
			yields:{
				type:"arr",
				match:{
					type:"obj",
					match:{
						itemId:"str",
						weight:"num"
					}
				}
			}
		}
	}
} as const satisfies Config

type ExtractorSchema = ConfType<typeof extractorSchema>



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
	const errors = []
	errors.push(...validate(items, itemSchema))
	errors.push(...validate(machines as any, machineSchema))
	errors.push(...validate(recipes, recipeSchema))
	errors.push(...validate(extraction, extractorSchema))

	if (errors.length > 0) throw new Error(JSON.stringify(errors, null, 3));

	return { 
		items: Object.entries(items).map(([key, value]) =>{
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
		machines: Object.entries(machines).map(([key, value]) => {
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
					metadata:null
				})),
				fuelNeeds:  machine.fuelNeeds,
				energyNeeds:machine.energyNeeds,
				workerNeeds:machine.workerNeeds,
			} satisfies MachineDef
		}
		),
		recipes: (recipes).map((r,i) => ({
			id:r.id??"v-"+i,
			inputs:r.inputs.map(i=>("id" in i ? {id:i.id, amount:i.amount} : {tag:i.tag, amount:i.amount})),
			outputs:r.outputs.map(i=>({id:i.id, amount:i.amount, metadata:null})),
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
	readonly cost: readonly ItemEntry[]
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

export type RecipeInput = {
	readonly amount: number
	readonly id: string
} | {
	readonly amount: number
	readonly tag: string
}

export type RecipeDef = {
	readonly id: string
	readonly inputs: readonly RecipeInput[]
	readonly outputs: readonly ItemEntry[]
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



