/** DOM id of the nth option in a listbox; shared so aria-activedescendant always matches. */
export function searchOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`
}
