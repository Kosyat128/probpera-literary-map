export type AdminAuthenticatorAssuranceLevel = "aal1" | "aal2" | null;

export function shouldRequireStaffMfa(input: {
  hasStaffRole: boolean;
  currentLevel: AdminAuthenticatorAssuranceLevel;
  nextLevel: AdminAuthenticatorAssuranceLevel;
}) {
  return (
    input.hasStaffRole &&
    input.currentLevel !== "aal2" &&
    input.nextLevel === "aal2"
  );
}

export function adminMfaStatusLabel(input: {
  currentLevel: AdminAuthenticatorAssuranceLevel;
  nextLevel: AdminAuthenticatorAssuranceLevel;
}) {
  if (input.currentLevel === "aal2") return "Подтверждено";
  if (input.nextLevel === "aal2") return "Требуется код";
  return "Не подключено";
}
