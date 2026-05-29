import type { CustomRecipeSer, ItemInstanceSer } from "../crafting-system/types";


export type JSONValue = string |
	number |
	boolean |
	null |
	JSONValue[] |
{ [key: string]: JSONValue; };


// Serialized minimal blueprint for constructing a MachineInstance
export type MachineInstanceBlueprint = Readonly<{
	capabilities: CustomRecipeSer[]
	cost: ItemInstanceSer[]
}>

