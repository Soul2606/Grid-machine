import { getDataMapToId } from "./game-data.js";
import { Inventory, MachineInstance, Signal, type MachineInstanceStatus } from "./classes.js";
import { relu } from "./functions.js";



export const mainInventory = new Inventory();

export const power = {value:0};

export const steamTurbines = {value:0};

export const maxPower = ()=>steamTurbines.value*20;

export const workers = provenance(10);




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
export function addToSimulation(machine:MachineInstance, tickCall:(status:MachineInstanceStatus)=>void):()=>boolean {
	return tick.subscribe((delta)=>{
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
		tickCall(status)
	})
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



