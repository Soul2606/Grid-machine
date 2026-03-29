import { getDataMapToId } from "./game-data.js";
import { Inventory, ItemEntry, MachineInstance, Signal, type MachineInstanceStatus } from "./classes.js";
import { relu } from "./functions.js";
import type { ItemInstanceSer, JSONValue, MachineInstanceSer } from "./types.js";




const machinesSimulated = new Map<MachineInstance, 
{
	readonly unsubscribe:()=>boolean
	readonly setTickEvent:(event:(status:MachineInstanceStatus)=>void)=>void
}>()



export const mainInventory = new Inventory();

export const power = {value:0};

export const steamTurbines = {value:0};

export const maxPower = ()=>steamTurbines.value*20;

export const workers = provenance(10);

export function removeMachine(mac:MachineInstance) {
	const existing = machinesSimulated.get(mac)
	if (existing === undefined) return false
	machinesSimulated.delete(mac)
	existing.unsubscribe()
	return true
}

export function getMachines() {
	return machinesSimulated
	.entries()
	.map(([key, val]) => ({
		machine:key,
		setTickEvent:val.setTickEvent
	}))
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
export function addToSimulation(machine:MachineInstance, tickCall?:(status:MachineInstanceStatus)=>void):()=>boolean {
	const existing = machinesSimulated.get(machine)
	let tickEvent = tickCall
	/**DO NOT LOSE THIS! */
	const unsubscribe = existing !== undefined
	? existing.unsubscribe
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
	machinesSimulated.set(machine, {
		unsubscribe,
		setTickEvent: event=>{
			tickEvent = event
		}
	})
	return ()=>{
		machinesSimulated.delete(machine)
		return unsubscribe()
	}
}




type SaveFormat = {
	version:number
	items:ItemInstanceSer[]
	machines:MachineInstanceSer[]
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
	console.log(save);
	if (save.version !== 0.1) console.warn(`Wrong save version, current: 0.1, save: ${save.version}`)
	mainInventory.clear()
	mainInventory.addItems(save.items.map(ItemEntry.fromSer))
	for (const mac of save.machines) {
		addToSimulation(MachineInstance.fromSer(mac)) // This is a problem. When a page loads the save, it needs to hook its ui reactivity to this event
	}
}




function provenance(initial = 0) {
	const sig = new Signal()
	const obj = {
		amount: initial,
		provenance: new Map<object, number>(),
		transfer: (amount: number, recipientId: object) => {
			let n = obj.provenance.get(recipientId) ?? 0;
			const delta = Math.max(Math.min(amount, obj.amount), -n);
			n += delta;
			obj.amount -= delta;
			n === 0 ? obj.provenance.delete(recipientId)
				: obj.provenance.set(recipientId, n);
			sig.send(undefined);
			return delta;
		},
		event: sig.createInterface(true),
	};
	return obj;
}






