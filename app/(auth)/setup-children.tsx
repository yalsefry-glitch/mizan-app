// app/(auth)/setup-children.tsx
// إعداد الأطفال أوّل مرّة بعد التسجيل: إضافة اسم الطفل واختيار صفّه.
// يدعم حتّى ٤ أطفال. كل طفل بصفّه المستقلّ (للتكيّف العمري).

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { addChild, getGrades } from '../../core/children';
import type { Grade } from '../../core/supabase';
import { theme } from '../../config/theme';

const MAX_CHILDREN = 4;

interface DraftChild {
  name: string;
  gradeId: string | null;
}

export default function SetupChildrenScreen() {
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [drafts, setDrafts] = useState<DraftChild[]>([{ name: '', gradeId: null }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const g = await getGrades();
      setGrades(g);
    })();
  }, []);

  const updateDraft = (index: number, patch: Partial<DraftChild>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const addRow = () => {
    if (drafts.length >= MAX_CHILDREN) return;
    setDrafts((prev) => [...prev, { name: '', gradeId: null }]);
  };

  const save = async () => {
    setError(null);
    const valid = drafts.filter((d) => d.name.trim() && d.gradeId);
    if (valid.length === 0) {
      setError('أضف طفلًا واحدًا على الأقلّ باسمه وصفّه');
      return;
    }

    setSaving(true);
    for (const d of valid) {
      await addChild({ name: d.name.trim(), gradeId: d.gradeId ?? undefined });
    }
    setSaving(false);
    router.replace('/profiles');
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Text style={s.title}>أضف أطفالك</Text>
      <Text style={s.sub}>لكل طفل عالمه الخاصّ حسب صفّه</Text>

      {drafts.map((draft, index) => (
        <View key={index} style={s.childCard}>
          <Text style={s.childNum}>الطفل {index + 1}</Text>
          <TextInput
            style={s.input}
            placeholder="اسم الطفل"
            placeholderTextColor={theme.colors.textMuted}
            value={draft.name}
            onChangeText={(t) => updateDraft(index, { name: t })}
          />
          <Text style={s.label}>الصفّ الدراسي</Text>
          <View style={s.gradeChips}>
            {grades.map((g) => {
              const selected = draft.gradeId === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[s.chip, selected && s.chipOn]}
                  onPress={() => updateDraft(index, { gradeId: g.id })}
                >
                  <Text style={[s.chipText, selected && s.chipTextOn]}>{g.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {drafts.length < MAX_CHILDREN && (
        <TouchableOpacity style={s.addBtn} onPress={addRow}>
          <Text style={s.addBtnText}>+ إضافة طفل آخر</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={s.error}>{error}</Text>}

      <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={s.saveBtnText}>حفظ والبدء</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, paddingTop: 60, paddingBottom: 50 },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  sub: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 22,
  },
  childCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 16,
  },
  childNum: {
    fontFamily: theme.fonts.headingMed,
    fontSize: 15,
    color: theme.colors.primaryDark,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 13,
    fontSize: 15,
    fontFamily: theme.fonts.body,
    color: theme.colors.textBody,
    marginBottom: 12,
  },
  label: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textBody,
    marginBottom: 8,
  },
  gradeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryDark,
  },
  chipText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textDark,
  },
  chipTextOn: { color: theme.colors.white },
  addBtn: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    padding: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  addBtnText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  error: {
    color: theme.colors.error,
    fontFamily: theme.fonts.bodyMed,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: theme.colors.white,
    fontFamily: theme.fonts.headingMed,
    fontSize: 16,
  },
});
