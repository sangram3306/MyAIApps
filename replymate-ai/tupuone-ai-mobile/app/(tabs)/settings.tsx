import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  type LayoutChangeEvent,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { BrandLogo, brandFont } from "../../components/BrandLogo";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../../constants/llm";
import {
  AppLockMode,
  DefaultTabId,
  ResponseCountPreference,
  buildLocalExportPayload,
  clearAllLocalAppData,
  getAppLockModePreference,
  getAutoCategorySuggestionsPreference,
  getBackendUrl,
  getBudgetTargetPreference,
  getBudgetWarningThresholdPreference,
  getDefaultTabPreference,
  getLlmPreference,
  getQuickAddCategoriesPreference,
  getReplyResponseCountPreference,
  getRewriteResponseCountPreference,
  getThemeModePreference,
  saveAppLockModePreference,
  saveAutoCategorySuggestionsPreference,
  saveBudgetTargetPreference,
  saveBudgetWarningThresholdPreference,
  saveDefaultTabPreference,
  saveQuickAddCategoriesPreference,
  saveReplyResponseCountPreference,
  saveRewriteResponseCountPreference,
} from "../../storage/appStorage";
import { clearExpensesFromApi } from "../../services/api";

const defaultTabOptions: { label: string; value: DefaultTabId }[] = [
  { label: "Home", value: "home" },
  { label: "Coach", value: "coach" },
  { label: "Chat", value: "chat" },
  { label: "Expenses", value: "expenses" },
];

const themeOptions = [
  { label: "System", value: "system" as const },
  { label: "Light", value: "light" as const },
  { label: "Dark", value: "dark" as const },
];

const responseCountOptions: { label: string; value: `${ResponseCountPreference}` }[] = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
];

export default function SettingsScreen() {
  const { colors, mode, resolvedTheme, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const appearanceSectionY = useRef(0);
  const scrollContainerRef = useRef<any>(null);
  const [llmPreference, setLlmPreference] = useState<LlmPreference>(defaultLlmPreference);
  const [defaultTab, setDefaultTab] = useState<DefaultTabId>("home");
  const [appLockMode, setAppLockMode] = useState<AppLockMode>("off");
  const [replyResponseCount, setReplyResponseCount] = useState<`${ResponseCountPreference}`>("5");
  const [rewriteResponseCount, setRewriteResponseCount] = useState<`${ResponseCountPreference}`>("5");
  const [budgetTarget, setBudgetTarget] = useState("");
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState("80");
  const [autoCategorySuggestions, setAutoCategorySuggestions] = useState(true);
  const [quickAddCategories, setQuickAddCategories] = useState<string[]>([
    "Food",
    "Groceries",
    "Transport",
  ]);
  const [newQuickCategory, setNewQuickCategory] = useState("");
  const [backendUrl, setBackendUrl] = useState("");
  const [exporting, setExporting] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);

  const selectedProvider =
    llmProviders.find((provider) => provider.id === llmPreference.provider) || llmProviders[0];
  const selectedModel = selectedProvider.models.find((model) => model.value === llmPreference.model);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getThemeModePreference(),
        getLlmPreference(),
        getDefaultTabPreference(),
        getAppLockModePreference(),
        getReplyResponseCountPreference(),
        getRewriteResponseCountPreference(),
        getBudgetTargetPreference(),
        getBudgetWarningThresholdPreference(),
        getAutoCategorySuggestionsPreference(),
        getQuickAddCategoriesPreference(),
        getBackendUrl(),
      ]).then(([, llm, tab, lockMode, replyCount, rewriteCount, target, threshold, autoCategory, quickAdds, url]) => {
        setLlmPreference(llm);
        setDefaultTab(tab);
        setAppLockMode(lockMode);
        setReplyResponseCount(String(replyCount) as `${ResponseCountPreference}`);
        setRewriteResponseCount(String(rewriteCount) as `${ResponseCountPreference}`);
        setBudgetTarget(target === null ? "" : String(target));
        setBudgetWarningThreshold(String(threshold));
        setAutoCategorySuggestions(autoCategory);
        setQuickAddCategories(quickAdds);
        setBackendUrl(url);
      });

      return () => {
        setExpandedSection(null);
      };
    }, []),
  );

  async function handleThemeChange(nextMode: "system" | "light" | "dark") {
    await setMode(nextMode);
  }

  async function handleDefaultTabChange(nextTab: DefaultTabId) {
    setDefaultTab(nextTab);
    await saveDefaultTabPreference(nextTab);
  }

  async function handleAppLockChange(nextMode: AppLockMode) {
    setAppLockMode(nextMode);
    await saveAppLockModePreference(nextMode);
  }

  async function handleReplyResponseCountChange(nextValue: `${ResponseCountPreference}`) {
    setReplyResponseCount(nextValue);
    await saveReplyResponseCountPreference(Number(nextValue));
  }

  async function handleRewriteResponseCountChange(nextValue: `${ResponseCountPreference}`) {
    setRewriteResponseCount(nextValue);
    await saveRewriteResponseCountPreference(Number(nextValue));
  }

  function openAppearanceSection() {
    setExpandedSection("appearance");
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo?.({
        animated: true,
        y: Math.max(0, appearanceSectionY.current - 12),
      });
    });
  }

  async function handleBudgetTargetCommit() {
    const numeric = budgetTarget.trim() ? Number(budgetTarget.replace(/,/g, "")) : null;
    if (budgetTarget.trim() && (numeric === null || !Number.isFinite(numeric) || numeric < 0)) {
      Alert.alert("Invalid target", "Enter a valid budget target amount.");
      return;
    }

    await saveBudgetTargetPreference(numeric);
  }

  async function handleBudgetThresholdCommit() {
    const numeric = Number(budgetWarningThreshold);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      Alert.alert("Invalid threshold", "Enter a percentage between 0 and 100.");
      return;
    }

    await saveBudgetWarningThresholdPreference(numeric);
  }

  async function handleAutoCategorySuggestionsChange(nextValue: boolean) {
    setAutoCategorySuggestions(nextValue);
    await saveAutoCategorySuggestionsPreference(nextValue);
  }

  async function handleAddQuickCategory() {
    const nextValue = newQuickCategory.trim();
    if (!nextValue) {
      return;
    }

    if (
      quickAddCategories.some((item) => item.toLowerCase() === nextValue.toLowerCase())
    ) {
      setNewQuickCategory("");
      return;
    }

    const nextCategories = [...quickAddCategories, nextValue];
    setQuickAddCategories(nextCategories);
    setNewQuickCategory("");
    await saveQuickAddCategoriesPreference(nextCategories);
  }

  async function handleRemoveQuickCategory(categoryToRemove: string) {
    const nextCategories = quickAddCategories.filter((item) => item !== categoryToRemove);
    setQuickAddCategories(nextCategories);
    await saveQuickAddCategoriesPreference(nextCategories);
  }

  async function handleReorderQuickCategories(data: string[]) {
    setQuickAddCategories(data);
    await saveQuickAddCategoriesPreference(data);
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const localExport = await buildLocalExportPayload();
      let expensesExport: unknown = null;

      if (backendUrl) {
        try {
          const response = await fetch(`${backendUrl}/api/expenses/export`);
          expensesExport = await response.json();
        } catch {
          expensesExport = { error: "Expense export unavailable right now." };
        }
      }

      await Share.share({
        title: "ReplyMate AI export",
        message: JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            local: localExport,
            backend: { expenses: expensesExport },
          },
          null,
          2,
        ),
      });
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Could not export data.");
    } finally {
      setExporting(false);
    }
  }

  async function handleClearAllData() {
    setClearingData(true);
    try {
      if (backendUrl) {
        try {
          await clearExpensesFromApi({ backendUrl });
        } catch {
          // Best effort. Local data will still be cleared.
        }
      }

      await clearAllLocalAppData();
      setLlmPreference(defaultLlmPreference);
      setDefaultTab("home");
      setAppLockMode("off");
      setReplyResponseCount("5");
      setRewriteResponseCount("5");
      setBudgetTarget("");
      setBudgetWarningThreshold("80");
      setAutoCategorySuggestions(true);
      setQuickAddCategories(["Food", "Groceries", "Transport"]);
      setNewQuickCategory("");
      await setMode("system");
      Alert.alert("Data cleared", "All local data and expenses were cleared.");
    } catch (error) {
      Alert.alert("Clear failed", error instanceof Error ? error.message : "Could not clear data.");
    } finally {
      setClearingData(false);
    }
  }

  return (
    <NestableScrollContainer
      ref={scrollContainerRef}
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTopRow}>
          <BrandLogo compact />
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" color={colors.primary} size={14} />
            <Text style={styles.heroBadgeText}>Secure backend</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>Control room</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Shape how ReplyMate behaves across replies, coach, privacy, expenses, and launch flow.
        </Text>
        <View style={styles.metaRow}>
          <MetaPill
            styles={styles}
            icon="hardware-chip-outline"
            label={`${selectedProvider.label}`}
            value={selectedModel?.label || llmPreference.model}
            onPress={() => router.push("/llm-provider" as never)}
          />
          <MetaPill
            styles={styles}
            icon="layers-outline"
            label="Launch tab"
            value={defaultTab}
            onPress={openAppearanceSection}
          />
          <MetaPill
            styles={styles}
            icon="contrast-outline"
            label="Theme"
            value={resolvedTheme}
            onPress={openAppearanceSection}
          />
        </View>
      </View>

      <AccordionSection
        id="coach"
        expandedSection={expandedSection}
        icon="sparkles-outline"
        title="Coach"
        subtitle="Open the smart analysis flow directly."
        summary="Jump to message analysis and reply guidance."
        styles={styles}
        onToggle={setExpandedSection}
      >
        <SettingLink
          icon="arrow-forward-outline"
          title="Open coach"
          copy="Jump to message analysis and reply guidance."
          onPress={() => router.push("/coach" as never)}
          styles={styles}
        />
      </AccordionSection>

      <AccordionSection
        id="privacy"
        expandedSection={expandedSection}
        icon="lock-closed-outline"
        title="Privacy"
        subtitle="Keep local and backend data boundaries clear."
        summary={`App lock: ${formatAppLockMode(appLockMode)}.`}
        styles={styles}
        onToggle={setExpandedSection}
      >
        <SettingNote
          title="Private by design"
          copy="Secrets stay on the backend and local data stays on-device."
          styles={styles}
        />

        <SegmentedGroup
          title="App lock"
          copy="Use Face ID, fingerprint, or passcode to open the app."
          options={[
            { label: "Off", value: "off" as const },
            { label: "Face ID", value: "faceId" as const },
            { label: "Fingerprint", value: "fingerprint" as const },
            { label: "Passcode", value: "passcode" as const },
          ]}
          value={appLockMode}
          onChange={handleAppLockChange}
          styles={styles}
        />

        <SettingButton
          icon="trash-outline"
          title={clearingData ? "Clearing..." : "Clear all data"}
          copy="Remove local history, favorites, settings, and expense data."
          onPress={handleClearAllData}
          disabled={clearingData}
          styles={styles}
        />
      </AccordionSection>

      <AccordionSection
        id="expenses"
        expandedSection={expandedSection}
        icon="wallet-outline"
        title="Expenses"
        subtitle="Go straight to spending insights."
        summary={`Budget target ${budgetTarget || "not set"}, smart categories ${autoCategorySuggestions ? "on" : "off"}.`}
        styles={styles}
        onToggle={setExpandedSection}
      >
        <SettingLink
          icon="arrow-forward-outline"
          title="Open expenses"
          copy="Jump into the expense tracker and AI summaries."
          onPress={() => router.push("/expenses" as never)}
          styles={styles}
        />

        <SettingToggle
          icon="sparkles-outline"
          title="Auto-category suggestions"
          copy="Turn smart category detection on or off."
          value={autoCategorySuggestions}
          onValueChange={handleAutoCategorySuggestionsChange}
          styles={styles}
        />

        <View style={styles.inlineGroup}>
          <SettingField
            icon="cash-outline"
            title="Budget target"
            copy="Set a monthly target that spending can warn against."
            value={budgetTarget}
            placeholder="e.g. 1500"
            keyboardType="decimal-pad"
            onChangeText={setBudgetTarget}
            onEndEditing={handleBudgetTargetCommit}
            styles={styles}
          />

          <SettingField
            icon="warning-outline"
            title="Warning threshold"
            copy="Warn when spending reaches a percentage of your target."
            value={budgetWarningThreshold}
            placeholder="e.g. 80"
            keyboardType="number-pad"
            suffix="%"
            onChangeText={setBudgetWarningThreshold}
            onEndEditing={handleBudgetThresholdCommit}
            styles={styles}
          />
        </View>

        <View style={styles.categoryManager}>
          <View style={styles.categoryManagerHeader}>
            <View style={styles.categoryManagerCopy}>
              <Text style={styles.rowTitle}>Quick-add categories</Text>
              <Text style={styles.rowCopy}>
                Add categories here, then drag to reorder how they appear in Expenses.
              </Text>
            </View>
            <View style={styles.categoryManagerAdd}>
              <TextInput
                placeholder="Add category"
                placeholderTextColor={colors.muted}
                style={styles.categoryManagerInput}
                value={newQuickCategory}
                onChangeText={setNewQuickCategory}
                onSubmitEditing={() => void handleAddQuickCategory()}
                returnKeyType="done"
              />
              <Pressable onPress={() => void handleAddQuickCategory()} style={styles.addButton}>
                <Ionicons name="add" color={colors.text} size={18} />
              </Pressable>
            </View>
          </View>

          <NestableDraggableFlatList
            data={quickAddCategories}
            keyExtractor={(item) => item}
            onDragEnd={({ data }) => {
              void handleReorderQuickCategories(data);
            }}
            renderItem={({ item, drag, isActive }: RenderItemParams<string>) => (
              <QuickCategoryRow
                category={item}
                isActive={isActive}
                onDelete={() => void handleRemoveQuickCategory(item)}
                onLongPress={drag}
                styles={styles}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.categorySeparator} />}
          />
        </View>
      </AccordionSection>

      <AccordionSection
        id="data"
        expandedSection={expandedSection}
        icon="download-outline"
        title="Data"
        subtitle="Back up your local data and expense summary."
        summary={exporting ? "Export in progress..." : "Share history, favorites, settings, and expenses."}
        styles={styles}
        onToggle={setExpandedSection}
      >
        <SettingButton
          icon="download-outline"
          title={exporting ? "Exporting..." : "Export data"}
          copy="Share history, favorites, settings, and backend expense data as JSON."
          onPress={handleExportData}
          disabled={exporting}
          styles={styles}
        />
      </AccordionSection>

      <AccordionSection
        id="appearance"
        expandedSection={expandedSection}
        icon="color-palette-outline"
        title="Appearance"
        subtitle="Control theme and launch behavior."
        summary={`Theme: ${resolvedTheme}. Launches to ${defaultTab}.`}
        styles={styles}
        onToggle={setExpandedSection}
        onLayout={(event) => {
          appearanceSectionY.current = event.nativeEvent.layout.y;
        }}
      >
        <SegmentedGroup
          title="Theme"
          copy="Choose how the app should follow your device and color preference."
          options={themeOptions}
          value={mode}
          onChange={handleThemeChange}
          styles={styles}
        />

        <SegmentedGroup
          title="Default tab on launch"
          copy="Pick which tab opens first when the app starts."
          options={defaultTabOptions}
          value={defaultTab}
          onChange={handleDefaultTabChange}
          styles={styles}
        />
      </AccordionSection>

      <AccordionSection
        id="llm"
        expandedSection={expandedSection}
        icon="hardware-chip-outline"
        title="LLM Provider"
        subtitle="Choose the backend model behind replies."
        summary={`${selectedProvider.label} · Reply ${replyResponseCount}, rewrite ${rewriteResponseCount}`}
        styles={styles}
        onToggle={setExpandedSection}
      >
        <SettingLink
          icon="chevron-forward-outline"
          title="Provider settings"
          copy={`${selectedProvider.label} · ${selectedModel?.label || llmPreference.model}`}
          onPress={() => router.push("/llm-provider" as never)}
          styles={styles}
        />

        <SegmentedGroup
          title="Reply responses"
          copy="Choose how many reply suggestions the AI should generate."
          options={responseCountOptions}
          value={replyResponseCount}
          onChange={handleReplyResponseCountChange}
          styles={styles}
        />

        <SegmentedGroup
          title="Rewrite responses"
          copy="Choose how many rewrite versions the AI should generate."
          options={responseCountOptions}
          value={rewriteResponseCount}
          onChange={handleRewriteResponseCountChange}
          styles={styles}
        />
      </AccordionSection>
    </NestableScrollContainer>
  );
}

type SectionId = "coach" | "privacy" | "expenses" | "data" | "appearance" | "llm";

function AccordionSection({
  id,
  icon,
  title,
  subtitle,
  summary,
  children,
  expandedSection,
  onToggle,
  onLayout,
  styles,
}: {
  id: SectionId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  summary: string;
  children: ReactNode;
  expandedSection: SectionId | null;
  onToggle: (id: SectionId | null) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  const expanded = expandedSection === id;
  return (
    <View
      onLayout={onLayout}
      style={[styles.sectionCard, expanded ? styles.sectionCardExpanded : styles.sectionCardCollapsed]}
    >
      <Pressable onPress={() => onToggle(expanded ? null : id)} style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} color={colors.primary} size={20} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{expanded ? subtitle : summary}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          color={colors.muted}
          size={18}
        />
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function SettingLink({
  icon,
  title,
  copy,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.rowCard}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} color={colors.primary} size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={20} />
    </Pressable>
  );
}

function SettingButton({
  icon,
  title,
  copy,
  onPress,
  disabled,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.rowCard, disabled && styles.rowCardDisabled]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} color={colors.primary} size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={20} />
    </Pressable>
  );
}

function SettingToggle({
  icon,
  title,
  copy,
  value,
  onValueChange,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.toggleCard}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} color={colors.primary} size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
      <Switch
        trackColor={{ false: colors.border, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : colors.surface}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function SettingField({
  icon,
  title,
  copy,
  value,
  placeholder,
  keyboardType,
  suffix,
  multiline = false,
  onChangeText,
  onEndEditing,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  value: string;
  placeholder: string;
  keyboardType?: "default" | "numeric" | "email-address" | "decimal-pad" | "number-pad";
  suffix?: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  onEndEditing: () => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fieldCard}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} color={colors.primary} size={20} />
      </View>
      <View style={styles.fieldBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
        <View style={styles.fieldInputWrap}>
          <TextInput
            keyboardType={keyboardType}
            multiline={multiline}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
            value={value}
            onChangeText={onChangeText}
            onEndEditing={() => void onEndEditing()}
          />
          {suffix ? <Text style={styles.fieldSuffix}>{suffix}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function SegmentedGroup<T extends string>({
  title,
  copy,
  options,
  value,
  onChange,
  styles,
}: {
  title: string;
  copy: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.segmentCard}>
      <View style={styles.segmentHeader}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCopy}>{copy}</Text>
      </View>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => void onChange(option.value)}
              style={[styles.segmentPill, selected && styles.segmentPillSelected]}
            >
              <Text style={[styles.segmentText, selected && { color: colors.primary }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SettingNote({
  title,
  copy,
  styles,
}: {
  title: string;
  copy: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.noteCard}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowCopy}>{copy}</Text>
    </View>
  );
}

function QuickCategoryRow({
  category,
  isActive,
  onLongPress,
  onDelete,
  styles,
}: {
  category: string;
  isActive: boolean;
  onLongPress: () => void;
  onDelete: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.categoryRow, isActive && styles.categoryRowActive]}
    >
      <View style={styles.categoryGrip}>
        <Ionicons name="reorder-three" color={colors.primary} size={20} />
      </View>
      <Text style={styles.categoryRowText}>{category}</Text>
      <Pressable onPress={onDelete} style={styles.categoryDeleteButton}>
        <Ionicons name="close" color={colors.muted} size={16} />
      </Pressable>
    </Pressable>
  );
}

function MetaPill({
  icon,
  label,
  value,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.metaPill, onPress && styles.metaPillInteractive]}
    >
      <Ionicons name={icon} color={colors.primary} size={14} />
      <View style={styles.metaPillText}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

function formatAppLockMode(value: AppLockMode): string {
  if (value === "faceId") return "Face ID";
  if (value === "fingerprint") return "Fingerprint";
  if (value === "passcode") return "Passcode";
  return "Off";
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      backgroundColor: colors.background,
      gap: spacing.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      overflow: "hidden",
      padding: spacing.lg,
    },
    heroGlow: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 140,
      opacity: 0.8,
      position: "absolute",
      right: -50,
      top: -60,
      width: 140,
    },
    heroTopRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      zIndex: 1,
    },
    heroBadge: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    heroBadgeText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
      zIndex: 1,
    },
    title: {
      color: colors.text,
      fontFamily: brandFont,
      fontSize: 34,
      fontWeight: "900",
      zIndex: 1,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
      zIndex: 1,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.xs,
      zIndex: 1,
    },
    metaPill: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      maxWidth: "100%",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaPillInteractive: {
      opacity: 0.98,
    },
    metaPillText: {
      flexShrink: 1,
      gap: 1,
    },
    metaLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    metaValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 18,
    },
    sectionCardCollapsed: {
      gap: 0,
      padding: spacing.md,
    },
    sectionCardExpanded: {
      gap: spacing.md,
      padding: spacing.md,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    sectionIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    sectionHeaderText: {
      flex: 1,
      gap: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    sectionSubtitle: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    sectionBody: {
      gap: spacing.sm,
    },
    inlineGroup: {
      gap: spacing.sm,
    },
    rowCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    rowCardDisabled: {
      opacity: 0.6,
    },
    toggleCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    rowIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    fieldBody: {
      flex: 1,
      gap: spacing.sm,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    rowCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    segmentCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    segmentHeader: {
      gap: 3,
    },
    segmentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    segmentPill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    segmentPillSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    segmentText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800",
    },
    fieldCard: {
      alignItems: "flex-start",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    fieldInputWrap: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    fieldInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontSize: 14,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    fieldInputMultiline: {
      minHeight: 66,
      textAlignVertical: "top",
    },
    fieldSuffix: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "900",
    },
    categoryManager: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    categoryManagerHeader: {
      gap: spacing.md,
    },
    categoryManagerCopy: {
      gap: 3,
    },
    categoryManagerAdd: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    categoryManagerInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontSize: 14,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    addButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    categorySeparator: {
      height: spacing.sm,
    },
    categoryRow: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    categoryRowActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    categoryGrip: {
      alignItems: "center",
      justifyContent: "center",
      width: 24,
    },
    categoryRowText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
    },
    categoryDeleteButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderRadius: 999,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    noteCard: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
  });
}
