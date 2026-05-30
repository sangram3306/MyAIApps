import { Role, roles } from "../constants/roles";
import { ChipSelector } from "./ChipSelector";

type Props = {
  selectedRole: Role;
  onSelect: (role: Role) => void;
};

export function RoleSelector({ selectedRole, onSelect }: Props) {
  return <ChipSelector options={roles} selectedValue={selectedRole} onSelect={onSelect} />;
}
