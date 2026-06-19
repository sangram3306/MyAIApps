import { useLocalSearchParams } from "expo-router";
import { SettingsContent } from "../../components/SettingsContent";

export default function SettingsScreen() {
  const params = useLocalSearchParams<{ expand?: string }>();
  return <SettingsContent defaultExpand={params.expand as any} />;
}
