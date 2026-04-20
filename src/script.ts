
import { getData } from "./game-data.js"; // async
import type { Item, Machine, Recipe } from './types.js'
import { get, getItemFromId, getRecipeInputs, getRecipeOutputs, getRecipesProducing, relu, removeAllChildren } from './functions.js'
import { Inventory, ItemEntry, ItemInstance, MachineInstance, ResolvedRecipe } from './classes.js'
import { createChemicalFormula, createInfoPanel, createItemCell, createMachine, createMachineUI, createQuantitySlider, createRecipeCard } from './ui-components.js'
import { getSignals, isPressed } from "./keyboard-events.js";
import { addSteamEngine, addToSimulation, getMachine, getMachines, getSteamEngines, getWorkers, load, mainInventory, power, tick as pubSubTick, save, setWorkers, workersReact } from "./engine.js";





// Global functions



function updateWorkers() {
	get("resources-workers")!.textContent = String(getWorkers())
}



function updatePower() {
	get("resources-power")!.textContent = power.value.toFixed(3)
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
	console.log("doing item transfer. Context;", transferContext.kind)
	if (transferContext.kind !== "empty" && transferContext.kind !== "item") return
	if (transferContext.kind === "item" && !transferContext.value.isEqual(item)) return

	const transfer = (amount:number) => {
		// try to subtract; if subtraction fails, restore UI and exit
		const removed = inventory.subtractItem(item, amount)
		if (!removed) {
		// optionally show a feedback/error in UI here
		return
		}

		// register the pending instance and transfer handler
		const value = ItemEntry.fromInst(item, amount)

		MouseOverlay.elements.heldItemIcon.setText(String(value.amount))
		if (value.item.img) MouseOverlay.elements.heldItemIcon.setImage(value.item.img)
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

	if (isPressed("ShiftLeft") && transferContext.kind === "empty") {
		const currentQty = Math.max(0, inventory.getAmount(item) || 0)
		if (currentQty < 1) return
		quantitySlider.setup(
			position.x, 
			position.y,
			currentQty, amount=>transfer(amount)
		)
	} else {
		if (transferContext.kind === "empty") {
			transfer(1)
		} else {
			const received = transferContext.value
			if (!received.isEqual(item)) return
			// Cancel the ongoing transfer and create a new transfer with both added together
			transferContext.transfer(false)
			transfer(received.amount + 1)
		}
	}
}




function setItemPopup(item:ItemInstance) {
	recipeHoverState = {valid:true, value:item}
	MouseOverlay.show()
	MouseOverlay.elements.infoPanel.show()
	MouseOverlay.elements.infoPanel.setTitle(item.item.name)
	const desc = MouseOverlay.elements.infoPanel.description
	removeAllChildren(desc)
	desc.append(createChemicalFormula(item.item.formula))
	desc.append(document.createElement("br"))
	desc.append((()=>{
		const el = document.createElement("span")
		el.textContent = item.item.description
		return el
	})())
}

function hideItemPopup(item:ItemInstance|null) {
	if (recipeHoverState?.valid && item && recipeHoverState.value.isEqual(item)) {
		recipeHoverState.valid = false
	}
	MouseOverlay.elements.infoPanel.hide()
}




function createProcessBox(capability:string) {
	const root = document.createElement("div")
	root.className = "capability-box"

	const header = document.createElement("span")
	header.className = "capability-box-header"
	header.textContent = capability
	root.append(header)

	const machinesList = document.createElement("div")
	machinesList.className = "capability-box-machines"
	for (const machine of machines.filter(m => m.capabilities.includes(capability))) {
		const img = document.createElement("img")
		img.src = machine.img
		machinesList.append(img)
	}
	root.append(machinesList)

	const recipeWindow = document.createElement("div")
	recipeWindow.className = "capability-box-recipe-box"
	root.append(recipeWindow)

	return {
		root,
		recipeWindow,
	}
}




//Global Variables

const keyboardEvents = getSignals()

/**
 * What state the side menu is in.
 */
var sideMenuMode:"recipes" | "inventory" | "machines" = "inventory"

/**
 * Used by "showUsage"
 */
var recipeHoverState: undefined | {valid:boolean, value:ItemInstance}


const items = getData().items
const machines = getData().machines
const recipes = getData().recipes
const extraction  = getData().extractors



const machineWindow = get("machine-window")
if (!machineWindow) throw new Error("error");

const recipeWindow = get("recipe-window")
if (!recipeWindow) throw new Error("error");

const recipeDisplay = get("recipe-display")
if (!recipeDisplay) throw new Error("error");

const steamEngines = get("steam-engines")
if (!steamEngines) throw new Error("error");

const addSteamEngineBtn = get("add-steam-engine")
if (!addSteamEngineBtn) throw new Error("error");




/*This is a singleton for managing the elements that follow the mouse*/
const MouseOverlay = (()=>{
	const element = get('mouse-icon')
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

				const textEl = document.createElement('span')
				root.appendChild(textEl)

				const img = document.createElement('img')
				root.appendChild(img)

				element.appendChild(root)
				return {
					...common(root),
					setText:(text: string)=>{
						textEl.textContent = text
					},
					setImage:(src: string)=>{
						img.src = src
					},
				} as const
			})(),

			// =============================== Info panel
			infoPanel:(()=>{
				const {root, setTitle, description} = createInfoPanel()
				element.appendChild(root)
				return {
					...common(root),
					setTitle,
					description
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

keyboardEvents.keydown.subscribe(code => {
	console.log("keydown: ", code)
	if (code !== "Escape") return
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




addSteamEngineBtn.addEventListener("click", ()=>{
	addSteamEngine()
})

pubSubTick.subscribe(()=>{
	steamEngines.textContent = String(getSteamEngines().value)
})


pubSubTick.subscribe(updatePower)




get('side-menu-width-button')!.addEventListener('mousedown',e=>{
	const minWidth = 300//px
	const originalMouseX = e.clientX
	const originalInventoryWidth = Number(get('side-menu')!.getBoundingClientRect().width)
	const up = ()=>{
		window.removeEventListener('mouseup',up)
		window.removeEventListener('mousemove',move)
	}
	const move = (e:MouseEvent)=>{
		e.clientX
		const newWidth = Math.max(originalInventoryWidth + e.clientX - originalMouseX, minWidth)
		get('side-menu-container')!.style.width = newWidth + 20 + 'px'
		get('side-menu')!.style.width = newWidth + 'px'
	}
	window.addEventListener('mousemove',move);
	window.addEventListener('mouseup',up)
});




get('machine-window-button')!.addEventListener('click',()=>{
	machineWindow.style.display = 'none'
})



get('recipe-window-button')!.addEventListener('click',()=>{
	recipeWindow.style.display = 'none'
})



document.body.classList.remove('loading')

updateWorkers()
workersReact.subscribe(updateWorkers)




const showItemRecipes = (recipes:readonly Recipe[]) => {
	const existingPro = new Map<string, HTMLElement>()

	recipeWindow.style.display = ""
	
	for (const r of recipes) {
		const card = createRecipeCard()
		card.setRecipe(r)

		const exist = existingPro.get(r.requiredProcess)
		if (exist) {
			exist.append(card.element)
		} else {
			const proBox = createProcessBox(r.requiredProcess)
			recipeDisplay.append(proBox.root)
			proBox.recipeWindow.append(card.element)
			existingPro.set(r.requiredProcess, proBox.recipeWindow)
		}

		card.events.onClick = value=>{
			if (value.type === "tag") return
			removeAllChildren(recipeDisplay)
			showItemRecipes(getRecipesProducing(value.value))
		}

		card.events.onMouseEnter = value=>{
			if (value.type === "tag") {
				MouseOverlay.show()
				MouseOverlay.elements.infoPanel.show()
				MouseOverlay.elements.infoPanel.setTitle(`Tag "${value}"`)
				return
			}
			setItemPopup(value.value)
		}

		card.events.onMouseLeave = value => {
			if (value.type === "tag") return
			hideItemPopup(value.value)
		}
	}
}




const showMachineRecipe = (machine:Machine) => {
	recipeWindow.style.display = ""
	const card = createRecipeCard()
	card.setMachineRecipe(machine)
	recipeDisplay.append(card.element)

	card.events.onMouseEnter = value => {
		if (value.type === "tag") return
		setItemPopup(value.value)
	}

	card.events.onMouseLeave = ()=>hideItemPopup(null)

	card.events.onClick = value => {
		if (value.type === "tag") return
		removeAllChildren(recipeDisplay)
		showItemRecipes(getRecipesProducing(value.value))
	}
}




const showItemUsage = (item:ItemInstance) => {
	const rs = recipes.filter(r =>
		r.inputs.some(i => i.id === item.item.id)
	)

	const ms = machines.filter(m =>
		m.cost.some(i => i.id === item.item.id)
	)

	removeAllChildren(recipeDisplay)
	showItemRecipes(rs)
	for (const m of ms) {
		showMachineRecipe(m)
	}
}



keyboardEvents.keydown.subscribe(code => {
	if (code !== "KeyU") return
	if (!recipeHoverState) return
	if (!recipeHoverState.valid) return
	const val = recipeHoverState.value
	showItemUsage(val)
})




const invItemCells = items.map(item => {
	const inst = ItemInstance.fromItem(item)
	const v = createItemCell(item)
	v.element.style.display = "none"

	v.element.addEventListener("mouseenter", ()=>setItemPopup(inst))
	v.element.addEventListener('mouseleave', ()=>hideItemPopup(inst))

	v.element.addEventListener('mousedown', e => {
		e.preventDefault()
		e.stopPropagation()
		if (sideMenuMode === "inventory") {
			itemTransferEvent({x:e.clientX, y:e.clientY}, mainInventory, ItemInstance.fromItem(v.getItem()))
		} else if (sideMenuMode === "recipes") {
			removeAllChildren(recipeDisplay)
			showItemRecipes(getRecipesProducing(inst))
		}
	})
	
	get('inventory-grid')!.appendChild(v.element)
	return v
})



mainInventory.signal.subscribe((itemInstance)=>{
	const item = itemInstance.item
	const amount = itemInstance.amount
	for(const cellElement of invItemCells){
		if (cellElement.getItem() !== item) continue
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
	get('machines-grid')!.appendChild(cell)

	cell.addEventListener('mouseenter', ()=>{
		MouseOverlay.show()
		MouseOverlay.elements.infoPanel.show()
		MouseOverlay.elements.infoPanel.setTitle(`${machine.name}`)
	})
	
	cell.addEventListener('mouseleave', ()=>{
		hideItemPopup(null)
	})

	cell.addEventListener('click',()=>{
		if (sideMenuMode === "machines") {
			if (transferContext.kind !== "empty") {
				transferContext.transfer(false)
				return
			}
			console.log("Clicked machine cell");
			const cost = machine.cost.map(ser =>
				ItemEntry.fromSer(ser)
			)
			console.log("machine costs: ", cost.map(i=>i.amount).join(","));
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
		} else if (sideMenuMode === "recipes") {
			removeAllChildren(recipeDisplay)
			showMachineRecipe(machine)
		}
	})

	machineCellElements.push({element:cell, machinePointer:machine})
}



{ // Side Menu Header Buttons functionality
const showGrid = (showInventory: boolean, showMachines: boolean) => {
	get('inventory-grid')!.style.display = showInventory ? '' : 'none';
	get('machines-grid')!.style.display = showMachines ? '' : 'none';
};

const repairCells = () => {
	for (const inventoryCell of invItemCells) {
		const entry = mainInventory.getAllItemInstances().find(e => e.item === inventoryCell.getItem());
		inventoryCell.element.style.display = entry && entry.amount > 0 ? '' : 'none';
		inventoryCell.amountLabel.style.display = ''
	}
};

get('side-menu-recipes-button')!
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

get('side-menu-inventory-button')!
.addEventListener('click', () => {
	sideMenuMode = 'inventory'
	showGrid(true, false);
	repairCells();
});

get('side-menu-machines-button')!
.addEventListener('click', () => {
	sideMenuMode = 'machines'
	showGrid(false, true);
	repairCells();
});
}



get('extract-starter')!.addEventListener('click',()=>{
	
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
		mainInventory.changeItem(ItemInstance.fromItem(getItemFromId(resultId)), 1)
	}
})



const machineUI = {
	...createMachineUI(pubSubTick),
	owner: null as null | MachineInstance,
}


machineUI.events.onAssignWorker = () => {
	const workers = getWorkers()
	if (workers < 1) return
	const owner = machineUI?.owner
	if (!owner) return
	const need = owner.getWorkerNeed()
	if (!need) return
	const status = owner.changeWorker(1)
	if (status === "success") {
		setWorkers(workers - 1)
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
		setWorkers(getWorkers() - 1)
	} else {
		console.log(status)
	}
}

machineUI.events.onStackUp = () => {
	console.log("Clicked stack up");
	const owner = machineUI.owner
	if (owner === null) return
	const cost = owner.cost
	
	const afford = mainInventory.subtractItems(cost)
	console.log("affordable?: ", afford)
	if (!afford) return
	owner.setStack(owner.getStack() + 1)
}


machineWindow.append(machineUI.element)




get('machine-line-cell-button')!.addEventListener('click',()=>{
	if (transferContext.kind !== "machine")return
	
	const machineObject = transferContext.value
	if (!machineObject) return
	
	const machineInst = MachineInstance.fromMachine(machineObject)
	
	addToSimulation(machineInst)
	get('machine-line')!.append(bindToUi(machineInst))

	transferContext.transfer(true)
	transferContext = {kind: "empty"}
})




const bindToUi = (machineInst:MachineInstance) => {
	const api = getMachine(machineInst);
	if (!api) throw new Error("Machine does not exist");

	const {element:root, setStack, setProgress, setWarning} = createMachine(machineInst.name, machineInst.sprite)
	setStack(machineInst.getStack())
	if (machineInst.getPowerNeed()) setWarning('no_fuel')

	root.addEventListener('click',()=>{
		if (transferContext.kind === "empty") {
			machineUI.owner = machineInst
			machineUI.events.onEvent = ()=>setStack(String(machineInst.getStack()))
			machineUI.refresh(machineInst, mainInventory, )
			machineWindow.style.display = ""
		} else if (transferContext.kind === "machine") {
			if (transferContext.value.id === machineInst.machineId) {
				machineInst.setStack(1 + machineInst.getStack())
				setStack(String(machineInst.getStack()))
				transferContext.transfer(true)
			} else {
				transferContext.transfer(false)
			}
		} else {
			const incoming = transferContext.value 
			console.log('incomingItem', incoming.item.id)
			if (incoming === null) return
			let success = false
			if (machineInst.addFuel(incoming) === "success") {
				success = true
				setWarning('')
			}
			if (!success) {
				const ri = machineInst.capableRecipes.values().toArray().map(r=>{ // Find a recipes that has 1 input and that input has at least 1 matching item
					return {
						recipe:r,
						inputs:getRecipeInputs(r)
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
								getRecipeOutputs(ri.recipe)
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
	
	
	// Declare setTimeout machine logic
	api.setTickEvent(status => {
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
	})

	return root
}




get("save").addEventListener("click", () => {
	save()
})

//In ui script.ts
get("load").addEventListener("click", () => {
	const machineLine = get('machine-line')
	for (const element of machineLine.querySelectorAll(":scope > .machine")) {
		element.remove()
	}
	load()
	for(const [machine, api] of getMachines()) {
		machineLine.append(bindToUi(machine))
	}
})

