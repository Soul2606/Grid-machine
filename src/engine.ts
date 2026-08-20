import { Machine, type MachineInstanceStatus } from "./classes/machine.js";
import { ItemEntry } from './classes/item-entry.js';
import { Item } from './classes/item.js';
import { Inventory } from './classes/inventory.js';
import { getItemFromId } from "./crafting-system/functions.js";
import { clamp } from "./common/utils.js";
import { relu } from "./common/utils.js";
import type { ItemSer, MachineSer } from "./crafting-system/types.js";
import type { MachineDef } from './game-data.js';
import { Signal } from "./lib/events/signal.js";


type MachineInstanceAPI = {
	readonly setTickEvent:(event:(status:MachineInstanceStatus)=>void)=>void
	readonly remove:()=>boolean
}



const machinesSimulated = new Map<Machine, MachineInstanceAPI>()



export const mainInventory = new Inventory();

export const power = {value:0};

const steamEngines = {
	value:0,
	// Hard coded stats are bad, this should be fetched from a config file
	info:{
		production:1000,
		consumption:0.01,
		fuelId:"raw_coal",
	} as const
};

export const maxPower = ()=>steamEngines.value*2000;




var workers = 10;

const workersSignal = new Signal()




export function getMachine(machine:Machine) {
	return machinesSimulated.get(machine)
}




export function getMachines() {
	return machinesSimulated.entries()
}




export const tick = (() => {
	const signal = new Signal<number>();
	let now = 0;
	const loop = () => {
		const t = Date.now();
		const deltaMS = t - now;
		now = t;
		signal.send(deltaMS);
		setTimeout(loop, 100); // Reduced lag
	};
	now = Date.now();
	loop();
	return signal.createInterface(false);
})();




/**
 * Adds machine to the simulation. Can cause memory leaks if unused machines are not removed.
 * @param tickCall This is called last, after all internal logic is run, so global values might be mutated.
 * @returns An unsubscribe function that removes this machine when called.
 */
export function addToSimulation(machine:Machine) {
	const existing = machinesSimulated.get(machine)
	let tickEvent:(status:MachineInstanceStatus)=>void | undefined

	/**DO NOT LOSE THIS! */
	const unsubscribe = existing !== undefined
	? existing.remove
	: tick.subscribe((delta)=>{
		// Get power
		;(()=>{
			const need = machine.getPowerNeed()
			if (need === undefined) return
			const delta = Math.min(relu(need.need * machine.getStack() - need.energy), power.value / need.voltageTier)
			const status = machine.addPower(
				delta,
				need.voltageTier
			)
			if (status === "success") {
				power.value -= (delta * need.voltageTier)
			}
		})();
		const status = machine.tick(delta)
		if (status === "idle") return
		mainInventory.addItems(status.crafted)
		if (tickEvent) tickEvent(status)
	})

	const api:MachineInstanceAPI = {
		remove: ()=>{
			if (unsubscribe()) {
				machinesSimulated.delete(machine)
				return true
			}
			return false
		},
		setTickEvent: event => {
			tickEvent = event
		}
	}

	machinesSimulated.set(machine, api)

	return api
}




type SaveFormat = {
	version:number
	items:ItemSer[]
	machines:MachineSer[]
}




export function save() {
	localStorage.setItem('save', JSON.stringify({
		version: 0.1,
		items:    mainInventory.getAllItemInstances().map(i => i.serialize()),
		machines: machinesSimulated.keys().toArray().map(v => v.serialize())
	} satisfies SaveFormat))
}




export function load()  {
	const save: SaveFormat = JSON.parse(localStorage.getItem('save')??"null")
	if (save.version !== 0.1) console.warn(`Wrong save version, current: 0.1, save: ${save.version}`)
	mainInventory.clear()
	mainInventory.addItems(save.items.map(ItemEntry.fromSer))
	for (const [mac, api] of machinesSimulated.entries()) {
		api.remove()
	}
	machinesSimulated.clear()
	for (const mac of save.machines) {
		addToSimulation(Machine.fromSer(mac))
	}
}




export function setWorkers(value:number) {
	workers = value
	workersSignal.send(undefined)
}




export function getWorkers() {
	return workers
}




export const workersReact = workersSignal.createInterface(true) 




export function addSteamEngine(amount=1) {
	if (mainInventory.subtractItems([
		ItemEntry.fromSer({id:"stone", amount:10*amount, metadata:null}),
	])) {
		steamEngines.value += amount
	}
}




export function getSteamEngines() {
	return steamEngines as Readonly<typeof steamEngines>
}




let fuelOverflow = 0
tick.subscribe(delta => {
	const fuel = Item.fromItem(getItemFromId(steamEngines.info.fuelId))
	const fuelAmount = mainInventory.getReflection(fuel).amount + fuelOverflow

	const fuelNeed = steamEngines.info.consumption
	const powerProduction = steamEngines.info.production * delta / 1000

	
	// All constraints expressed as "max engines that can run"
	const byEngines = steamEngines.value
	const byFuel = fuelAmount / fuelNeed
	const byStorage = (maxPower() - power.value) / powerProduction

	const running = Math.min(byEngines, byFuel, byStorage)

	const powerGain = running * powerProduction
	const fuelUsed = relu(running * fuelNeed - fuelOverflow)
	fuelOverflow -= clamp(running * fuelNeed, 0, fuelOverflow)
	fuelOverflow += Math.ceil(fuelUsed) - fuelUsed

	if (!mainInventory.subtractItem(fuel, Math.ceil(fuelUsed))) {
		throw new Error("Invariant broke")
	}

	power.value += powerGain
})







