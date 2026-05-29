import type { Item } from "../crafting-system/types";

/**
 * Can be mutated! Use itemPointer to get which item this cell currently represents.
 * @param item The item that the cell represents
 * @returns
 */
export function createItemCell(item: Item) {
	let itemPointer = item;
	const cell = document.createElement('div');
	cell.className = 'inventory-grid-cell';

	const number = document.createElement('span');
	number.textContent = '0';
	cell.appendChild(number);

	function setItem(item: Item) {
		itemPointer = item;
		cell.style.backgroundImage = item.img ? `url(${item.img})` : '';
	}
	setItem(item);

	return {
		element: cell,
		amountLabel: number,
		getItem: () => itemPointer,
		setItem
	} as const;
}
