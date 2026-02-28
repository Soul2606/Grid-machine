
import type { Item, Machine, Recipe, Extractor } from './types.js'
import { fetchData, getItemFromId, getRecipeInputs, getRecipeOutputs, getRecipesProducing, tryCraft } from './functions.js'
import { Inventory, ItemEntry, ItemInstance, MachineInstance, ResolvedRecipe, Signal } from './classes.js'
import { createItemCell, createMachine, createMachineUI, createQuantitySlider } from './ui-components.js'

type InfoPanelMethods = {
	show: () => void
	hide: () => void
	setText: (text: string) => void
}

type HeldItemIconMethods = {
	show: () => void
	hide: () => void
	setText: (text: string) => void
	setImage: (src: string) => void
}




// Global functions



function updateWorkers() {
	document.getElementById("resources-workers")!.textContent = String(workers.amount)
}



function stepExponential(n: number){
	const preset = [
		1,5,10,20,30,40,50,100,200,300,400,500,600,700,800,900,1000,
		2000,3000,4000,5000,6000,7000,8000,9000,10000,20000,30000,40000,
		50000,60000,70000,80000,90000,100000,200000,300000,400000,500000,1000000
	]
	const candidates = preset.filter(v => v < n)
	if (candidates[candidates.length - 1] !== n) candidates.push(n)
	return {candidates, preset}
}





/**
 * When this function is called it will show the slider and set up events for items transfer of a specified item from the provided inventory into the transfer context
 * from there you can resolve the transfer from anywhere in the script since transfer context is a global variable. 
 * @param position slider spawn position
 * @param inventory inventory class to transfer from
 * @param item the item to transfer
 * @returns void
 */
function itemTransferEvent(position:{x:number, y:number}, inventory:Inventory, item:ItemInstance): void {
	console.log("doing item transfer. Context;", transferContext)
	if (transferContext.kind !== "empty") return

	const currentQty = Math.max(0, inventory.getAmount(item) || 0)
	if (currentQty < 1) return

	const {candidates, preset} = stepExponential(currentQty)

	const steps = candidates.length
	if (steps === 0) return

	const formatLabel = (idx: number) => `${candidates[idx]}/${currentQty}`

	quantitySlider.show(position.x, position.y, formatLabel(0), steps)

	const onInput = (step: number) => {
		const index = Math.max(0, Math.min(steps - 1, step - 1))
		quantitySlider.setText(formatLabel(index))
	}

	const onEnd = (step: number) => {
		quantitySlider.setInputCallback(null)
		quantitySlider.setEndCallback(null)

		const index = Math.max(0, Math.min(steps - 1, step - 1))
		const amount = candidates[index] ? candidates[index] : preset[preset.length-1] as number

		// try to subtract; if subtraction fails, restore UI and exit
		const removed = inventory.subtractItem(item, amount)
		if (!removed) {
		// optionally show a feedback/error in UI here
		return
		}

		// register the pending instance and transfer handler
		const value = ItemEntry.fromInst(item, amount)

		MouseOverlay.elements.heldItemIcon.setText(`${value.item.name}:${value.amount}`)
		MouseOverlay.elements.heldItemIcon.show(true)
		MouseOverlay.show()

		// transfer is called to resolve ItemTransferContext
		const transfer = (success: boolean) => {
			transferContext = {kind: "empty"}
			MouseOverlay.elements.heldItemIcon.hide()
			MouseOverlay.hide()
			if (success) return
			// on failure attempt refund 
			if (!inventory.addItem(item, amount)) {
				//If refund fail default to refunding the players inventory
				if (!mainInventory.addItem(item, amount)) throw new Error("could not add items to mainInventory");
			}
		}

		transferContext = {
			kind: "item",
			value,
			transfer
		}
	}

	quantitySlider.setInputCallback(onInput)
	quantitySlider.setEndCallback(onEnd)
}



//Global Variables

let dataIsCompiled = false

const workers = {
	amount: 10,
	provenance: new Map<object,number>(),
	transfer: (amount:number, recipientId:object) => {
		let n = workers.provenance.get(recipientId) ?? 0
		const delta = Math.max(Math.min(amount, workers.amount), -n)
		n += delta
		workers.amount -= delta
		n === 0 ? workers.provenance.delete(recipientId)
		: workers.provenance.set(recipientId, n)
		updateWorkers()
		return delta
	},
}


/**
 * What state the side menu is in.
 */
var sideMenuMode: undefined | "recipes" | "inventory" | "machines"

/* These will be assigned after compilation. Should be validated outside the main function*/

var items: readonly Item[]

var machines: readonly Machine[]

var recipes: readonly Recipe[]

var extraction: readonly Extractor[]


// Main global inventory
const mainInventory = new Inventory()



/*This is a singleton for managing the elements that follow the mouse*/
const MouseOverlay = (()=>{
	const element = document.getElementById('mouse-icon')
	if (element === null) throw new Error("No root mouse element found");
	let visible = false

	window.addEventListener('mousemove',e=>{
		if (!visible) return
		element.style.transform = `translate(${e.pageX}px, ${e.pageY}px)`

	})

	let active: undefined | HTMLElement
	function common(root:HTMLElement) {
		return {
			show:(force?:true) => {
				if (active === root) return
				if (active) {
					if (!force) return
					active.style.display = "none"
				}
				active = root
				root.style.display = ""
			},
			hide:() => {
				if (active === root) active = undefined
				root.style.display = "none"
			},
			isActive:() => active === root
		}
	}

	return {
		element,

		active,

		show:() => {
			visible = true
			element.style.display = ''
		},
	
		hide:() => {
			visible = false
			element.style.display = 'none'
		},
		
		elements:{

			// =============================== Held item icon
			heldItemIcon:(()=>{
				const root = document.createElement('div')
				root.className = 'held-item-icon'
				root.style.display = 'none'

				const p = document.createElement('p')
				root.appendChild(p)

				const img = document.createElement('img')
				root.appendChild(img)

				element.appendChild(root)
				return {
					...common(root),
					setText:(text: string)=>{
						p.textContent = text
					},
					setImage:(src: string)=>{
						img.src = src
					},
				} as const
			})(),

			// =============================== Info panel
			infoPanel:(()=>{
				const root = document.createElement('div')
				root.className = 'mouse-info-panel'
				root.style.display = 'none'
				element.appendChild(root)
				return {
					...common(root),
					setText:(text:string)=>{
						root.textContent = text
					}
				} as const
			})(),

		}
	} as const
})()




type TransferContext = {
	kind: "empty"
}
| {
	kind: "item"
	value: ItemEntry
	transfer: (success:boolean) => void
}
| {
	kind: "machine"
	value: Machine
	transfer: (success:boolean) => void
}

/**
 * Stores context for an in-progress transfer.
 *
 * - kind:
 *   Describes what is being transferred, or "empty" if no transfer is active.
 *
 * - value:
 *   Present only when kind !== "empty".
 *   The thing being transferred.
 *
 * - transfer:
 *   Created by the sender of the transfer.
 *   Called by the recipient with a success status.
 *
 *   IMPORTANT:
 *   Always assume on both sides that transferContext has been mutated after transfer is called.
 *   The transfer function is responsible for refunding the sender
 *   if the transfer fails.
 *
 *   !!! REFUNDS MUST BE HANDLED BY THE SENDER, NOT THE RECIPIENT !!!
 */

let transferContext: TransferContext = {
	kind: "empty"
}

window.addEventListener("keydown", e => {
	console.log("keydown: ", e.key)
	if (e.key !== "Escape") return
	if (transferContext.kind === "empty") return
	transferContext.transfer(false)
	transferContext = {kind: "empty"}
})




// Item amount slider
const quantitySlider = (()=>{
	const slider = createQuantitySlider()
	document.body.append(slider.element)
	return slider.methods
})();




const pubSubTick = (()=>{
	const signal = new Signal<number>()
	let now = 0
	const loop = ()=>{
		const t = Date.now()
		const deltaMS = t - now
		now = t
		signal.send(deltaMS)
		setTimeout(loop, 100) // Reduced lag
	}
	now = Date.now()
	loop()
	return signal.createInterface(false)
})()






document.getElementById('side-menu-width-button')!.addEventListener('mousedown',e=>{
	const minWidth = 300//px
	const originalMouseX = e.clientX
	const originalInventoryWidth = Number(document.getElementById('side-menu')!.getBoundingClientRect().width)
	const up = ()=>{
		window.removeEventListener('mouseup',up)
		window.removeEventListener('mousemove',move)
	}
	const move = (e:MouseEvent)=>{
		e.clientX
		const newWidth = Math.max(originalInventoryWidth + e.clientX - originalMouseX, minWidth)
		document.getElementById('side-menu-container')!.style.width = newWidth + 20 + 'px'
		document.getElementById('side-menu')!.style.width = newWidth + 'px'
	}
	window.addEventListener('mousemove',move);
	window.addEventListener('mouseup',up)
});




document.getElementById('machine-window-button')!.addEventListener('click',()=>{
	document.getElementById('machine-window')!.style.display = 'none'
})




fetchData().then(main)

function main(response:{items:Item[], machines:Machine[], recipes:Recipe[], extraction:Extractor[]}) {
	dataIsCompiled = true

	items = response.items
	machines = response.machines
	recipes = response.recipes

	extraction  = response.extraction

	document.body.classList.remove('loading')

	updateWorkers()

	const invItemCells = items.map(r => {
		const v = createItemCell(r)
		v.element.style.display = "none"

		v.element.addEventListener("mouseenter", e => {
			MouseOverlay.show()
			MouseOverlay.elements.infoPanel.show()
			MouseOverlay.elements.infoPanel.setText(r.name)
		})

		v.element.addEventListener('mouseleave', ()=>{
			MouseOverlay.elements.infoPanel.hide()
			MouseOverlay.elements.infoPanel.setText('')
		})

		v.element.addEventListener('mousedown', e => {
			e.preventDefault()
			e.stopPropagation()
			itemTransferEvent({x:e.clientX, y:e.clientY}, mainInventory, ItemInstance.fromItem(v.itemPointer))
		})
		
		document.getElementById('inventory-grid')!.appendChild(v.element)
		return v
	})



	mainInventory.signal.subscribe((itemInstance)=>{
		const item = itemInstance.item
		const amount = itemInstance.amount
		for(const cellElement of invItemCells){
			if (cellElement.itemPointer !== item) continue
			cellElement.amountLabel.textContent = String(amount) // Yes this is correct
			if (sideMenuMode === 'recipes') continue
			cellElement.element.style.display = ''
		}
	})



	const machineCellElements: {element:HTMLDivElement, machinePointer:Machine}[] = []
	for(const machine of machines){
		const cell = document.createElement('div')
		cell.className = 'inventory-grid-cell'
		cell.textContent = machine.name
		if (machine.img) cell.style.backgroundImage = `url(${machine.img})`
		document.getElementById('machines-grid')!.appendChild(cell)

		cell.addEventListener('mouseenter', ()=>{
			const inputs = machine.cost

			MouseOverlay.show()
			MouseOverlay.elements.infoPanel.show()

			const text = inputs.map(input=>{
				let item = items.find(item=>item.id === input.id)
				if (item) {
					return `${item.name}: ${input.amount}, `
				} else {
					return 'unknown'
				}
			}).join(', ')

			MouseOverlay.elements.infoPanel.setText(`Ingredients:${text}`)
		})
		
		cell.addEventListener('mouseleave', ()=>{
			MouseOverlay.elements.infoPanel.hide()
			MouseOverlay.elements.infoPanel.setText('')
		})

		cell.addEventListener('click',()=>{
			if (transferContext.kind !== "empty") {
				transferContext.transfer(false)
				return
			}
			console.log("Clicked machine cell");
			const cost = machine.cost.map(ser =>
				ItemEntry.fromRef(ser, items)
			)
			console.log("machine costs: ", cost);
			if (!mainInventory.subtractItems(cost)) return
			transferContext = {
				kind: "machine",
				value: machine,
				transfer: (success)=>{
					transferContext = {kind: "empty"}
					cell.style.backgroundColor = ''
					if (success) return
					mainInventory.addItems(cost)
				}
			}
			cell.style.backgroundColor = 'green'
		})

		machineCellElements.push({element:cell, machinePointer:machine})
	}



	{ // Side Menu Header Buttons functionality
	const showGrid = (showInventory: boolean, showMachines: boolean) => {
		document.getElementById('inventory-grid')!.style.display = showInventory ? '' : 'none';
		document.getElementById('machines-grid')!.style.display = showMachines ? '' : 'none';
	};
	
	const repairCells = () => {
		for (const inventoryCell of invItemCells) {
			const entry = mainInventory.getAllItemInstances().find(e => e.item === inventoryCell.itemPointer);
			inventoryCell.element.style.display = entry && entry.amount > 0 ? '' : 'none';
			inventoryCell.amountLabel.style.display = ''
		}
	};
	
	document.getElementById('side-menu-recipes-button')!
	.addEventListener('click', () => {
		sideMenuMode = 'recipes'
		showGrid(true, true);
		for (const inventoryCell of invItemCells) {
			inventoryCell.element.style.display = '' 
			inventoryCell.amountLabel.style.display = 'none'
		}
		for (const machineCell of machineCellElements) {
			machineCell.element.style.display = ''
		}
	});
	
	document.getElementById('side-menu-inventory-button')!
	.addEventListener('click', () => {
		sideMenuMode = 'inventory'
		showGrid(true, false);
		repairCells();
	});
	
	document.getElementById('side-menu-machines-button')!
	.addEventListener('click', () => {
		sideMenuMode = 'machines'
		showGrid(false, true);
		repairCells();
	});
	}



	document.getElementById('extract-starter')!.addEventListener('click',()=>{
		
		const starterMine = extraction.find(item=>item.id==='starter')
		if (!starterMine) throw new Error("Could not find the starter extractor");
		const totalWeight = starterMine.yields.map(val=>val.weight).reduce((prev,val)=>prev+val,0)
		for (let i = 0; i < starterMine.manualPower; i++) {
			const randomNumber = Math.floor(Math.random()*totalWeight)
			let resultId: string|null = null
			let cumulative = 0
			for (const value of starterMine.yields) {
				cumulative += value.weight
				if (randomNumber < cumulative) {
					resultId = value.itemId
					break
				}
			}
			if (resultId === null) continue
			mainInventory.changeItem(ItemInstance.fromItem(getItemFromId(resultId, items)), 1)
		}
	})



	const machineUI = {
		...createMachineUI(recipes, items, pubSubTick),
		owner: null as null | MachineInstance,
	}

	
	machineUI.events.onAssignWorker = () => {
		if (workers.amount < 1) return
		const owner = machineUI?.owner
		if (!owner) return
		const need = owner.getWorkerNeed()
		if (!need) return
		const status = owner.changeWorker(1)
		if (status === "success") {
			workers.transfer(1, owner)
		} else {
			console.log(status)
		}
	}

	machineUI.events.onLayOffWorker = () => {
		const owner = machineUI?.owner
		if (!owner) return
		const need = owner.getWorkerNeed()
		if (!need) return
		const status = owner.changeWorker(-1)
		if (status === "success") {
			workers.transfer(-1, owner)
		} else {
			console.log(status)
		}
	}

	machineUI.events.onStackUp = () => {
		console.log("Clicked stack up");
		const owner = machineUI.owner
		if (owner === null) return
		const cost = owner.cost
		console.log("inv: ", mainInventory);
		
		const afford = mainInventory.subtractItems(cost)
		console.log("affordable?: ", afford, "cost: ", cost)
		if (!afford) return
		owner.setStack(owner.getStack() + 1)
	}
	

	document.getElementById("machine-window")!.append(machineUI.element)




	document.getElementById('machine-line-cell-button')!.addEventListener('click',()=>{
		if (transferContext.kind !== "machine")return
		
		const machineObject = transferContext.value
		if (!machineObject) return
		const {element:machineCell, setStack, setProgress, setWarning} = createMachine(machineObject)
		setWarning('no_fuel')

		const machineInst = MachineInstance.fromMachine(machineObject, items, recipes)

		machineCell.addEventListener('click',()=>{
			if (transferContext.kind === "empty") {
				machineUI.owner = machineInst
				machineUI.events.onEvent = ()=>setStack(String(machineInst.getStack()))
				machineUI.refresh(machineInst, mainInventory, )
				document.getElementById("machine-window")!.style.display = ""
			} else if (transferContext.kind === "machine") {
				if (transferContext.value.id === machineObject.id) {
					machineInst.setStack(1 + machineInst.getStack())
					setStack(String(machineInst.getStack()))
					transferContext.transfer(true)
				} else {
					transferContext.transfer(false)
				}
			} else {
				const incoming = transferContext.value 
				console.log('incomingItem', incoming)
				if (incoming === null) return
				let success = false
				if (machineInst.addFuel(incoming) === "success") {
					success = true
					setWarning('')
				}
				if (!success) {
					console.log("incoming item:", incoming)
					const ri = machineInst.capableRecipes.map(r=>{ // Find a recipes that has 1 input and that input has at least 1 matching item
						return {
							recipe:r,
							inputs:getRecipeInputs(r, items)
						}
					}).filter(obj=>
						obj.inputs.length === 1
					).map(obj=>{
						const slot = obj.inputs[0]!
						const input = slot.items.find(i=>i.isEqual(incoming) && slot.amount <= incoming.amount)
						if (input === undefined) return null
						return{
							recipe: obj.recipe,
							input: ItemEntry.fromInst(input, slot.amount)
						} as const
					}).find(ri => ri !== null)
					console.log("found ri: ", ri)
					if (ri) {
						const cost1 = ri.input.amount
						const batches = Math.floor(incoming.amount / cost1)
						console.log("baches: ", batches)
						if (batches > 0) {						
							success = true // success so the main inventory does not get it back
							machineInst.addWorkingOn(
								Array(batches).fill(new ResolvedRecipe(
									ri.recipe.id,
									[ri.input],
									getRecipeOutputs(ri.recipe, items)
								))
							)
							mainInventory.addItem(incoming, incoming.amount - cost1 * batches) // Give back leftovers
						}
					}
				}
				console.log("success: ", success)
				transferContext.transfer(success)
			}
			transferContext = {kind: "empty"}
		})



		document.getElementById('machine-line')!.appendChild(machineCell)
		transferContext.transfer(true)
		transferContext = {kind: "empty"}
		
		
		// Declare setTimeout machine logic
		const unsubscribe = pubSubTick.subscribe(deltaMS => {
			const status = machineInst.tick(deltaMS)
			if (machineUI.owner === machineInst) {
				machineUI.refreshText(machineInst)
			}
			if (status === "idle") return
			if (status.lowEnergy) {
				setWarning("no_fuel")
			} else {
				setWarning("")
			}
			if (status.progress) {
				setProgress(status.progress * 100)
			} else {
				setProgress(100)
			}
			mainInventory.addItems(status.crafted)
		})
	})

}



setTimeout(()=>{
	if (dataIsCompiled) return
	document.getElementById('loading-screen')!.innerHTML = `
	<p>ERROR: could not get game data.</p>
	<p>You can download them manually from <a href="YOUR_LINK_HERE" target="_blank">this page</a> and import the JSON files into the document.</p>`
}, 10000)

