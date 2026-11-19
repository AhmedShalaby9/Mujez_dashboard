/** Employee remains assigned for access, but is a label only for employee-only users. */
export function visibleCompanyRoles<T extends string>(roles: readonly T[]): T[] {
  const otherRoles = roles.filter((role) => role !== 'employee');
  return otherRoles.length ? otherRoles : [...roles];
}
