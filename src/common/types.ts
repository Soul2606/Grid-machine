import type { Recipe } from "../crafting-system/types";
import type { Item } from '../classes/item'


export type JSONValue = string |
	number |
	boolean |
	null |
	JSONValue[] |
{ [key: string]: JSONValue; };


// Serialized minimal blueprint for constructing a MachineInstance
export type MachineInstanceBlueprint = Readonly<{
	capabilities: Recipe[]
	cost: Item[]
}>

