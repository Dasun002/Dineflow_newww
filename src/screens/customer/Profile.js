// Customer Profile tab – shows registered details, allows name update, sign out, and dining preferences CRUD
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen, Button, Card, Field, Label, H, Muted, Row, Chip, Empty, Callout } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useUserPreferences } from '../../hooks';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { addUserPreference, updateUserPreference, deleteUserPreference } from '../../services/db';
import { colors } from '../../theme';
import { friendlyErr } from '../../utils';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = [
  { key: 'Dietary', label: 'Dietary', tone: 'green', icon: 'nutrition-outline' },
  { key: 'Accessibility', label: 'Accessibility', tone: 'accent', icon: 'body-outline' },
  { key: 'Seating', label: 'Seating', tone: 'amber', icon: 'restaurant-outline' },
  { key: 'Other', label: 'Other', tone: 'gray', icon: 'bookmark-outline' },
];

const PRESETS = [
  { category: 'Dietary', title: 'Nut Allergy' },
  { category: 'Dietary', title: 'Gluten-Free' },
  { category: 'Dietary', title: 'Vegetarian / Vegan' },
  { category: 'Accessibility', title: 'Wheelchair Accessible' },
  { category: 'Seating', title: 'Quiet Booth' },
  { category: 'Seating', title: 'Window View' },
];

export default function Profile() {
  const { user, guestName, setGuestName, logout } = useAuth();
  const [name, setName] = useState(guestName || '');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dining preferences state
  const { preferences, loading: loadingPrefs } = useUserPreferences(user?.uid);
  const [showPrefForm, setShowPrefForm] = useState(false);
  const [editingPrefId, setEditingPrefId] = useState(null);
  const [prefCategory, setPrefCategory] = useState('Dietary');
  const [prefTitle, setPrefTitle] = useState('');
  const [prefNotes, setPrefNotes] = useState('');
  const [prefSubmitting, setPrefSubmitting] = useState(false);
  const [prefError, setPrefError] = useState(null);
  const [prefSuccess, setPrefSuccess] = useState(null);

  // Keep local name in sync if guestName loads slightly after mount
  useEffect(() => {
    if (!name && guestName) setName(guestName);
  }, [guestName]);

  // Load full profile from Firestore
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid))
      .then((s) => {
        if (s.exists()) {
          const d = s.data();
          setName(d.name || guestName || '');
          setEmail(d.email || user.email || '');
          setMobile(d.mobile || '');
        } else {
          setName(guestName || '');
          setEmail(user.email || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const saveName = async () => {
    if (!name.trim()) return;
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { name: name.trim() });
      }
      setGuestName(name.trim());
      setSaved(true);
    } catch (e) {
      setGuestName(name.trim());
      setSaved(true);
    }
  };

  const openNewPrefForm = () => {
    setEditingPrefId(null);
    setPrefCategory('Dietary');
    setPrefTitle('');
    setPrefNotes('');
    setPrefError(null);
    setShowPrefForm(true);
  };

  const openEditPrefForm = (item) => {
    setEditingPrefId(item.id);
    setPrefCategory(item.category || 'Dietary');
    setPrefTitle(item.title || '');
    setPrefNotes(item.notes || '');
    setPrefError(null);
    setShowPrefForm(true);
  };

  const handleSavePreference = async () => {
    if (!prefTitle.trim()) {
      setPrefError('Please enter a preference title (e.g., Peanut allergy, Wheelchair ramp).');
      return;
    }
    setPrefSubmitting(true);
    setPrefError(null);
    try {
      if (editingPrefId) {
        await updateUserPreference(user.uid, editingPrefId, {
          category: prefCategory,
          title: prefTitle,
          notes: prefNotes,
        });
        setPrefSuccess('Preference updated successfully!');
      } else {
        await addUserPreference(user.uid, {
          category: prefCategory,
          title: prefTitle,
          notes: prefNotes,
        });
        setPrefSuccess('Preference added successfully!');
      }
      setShowPrefForm(false);
      setEditingPrefId(null);
      setPrefTitle('');
      setPrefNotes('');
      setTimeout(() => setPrefSuccess(null), 3000);
    } catch (e) {
      setPrefError(friendlyErr(e));
    } finally {
      setPrefSubmitting(false);
    }
  };

  const handleDeletePreference = (item) => {
    Alert.alert(
      'Delete Preference',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserPreference(user.uid, item.id);
              setPrefSuccess('Preference removed.');
              setTimeout(() => setPrefSuccess(null), 3000);
            } catch (e) {
              Alert.alert('Delete failed', friendlyErr(e));
            }
          },
        },
      ]
    );
  };

  const getCategoryTone = (cat) => {
    const found = CATEGORIES.find((c) => c.key === cat);
    return found ? found.tone : 'gray';
  };

  return (
    <Screen title="My Profile" subtitle="Your details and dining preferences">
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>
            {name.trim() ? name.trim()[0].toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 10 }}>{name || 'Guest'}</Text>
        {email ? <Text style={{ color: colors.sub, fontSize: 13 }}>{email}</Text> : null}
      </View>

      {/* Edit name */}
      <Card>
        <Label>Display name</Label>
        <Field
          value={name}
          onChangeText={(v) => { setName(v); setSaved(false); }}
          autoCapitalize="words"
          placeholder="Your name"
        />
        <Button
          title={saved ? 'Saved ✓' : 'Save name'}
          variant="secondary"
          disabled={!name.trim()}
          onPress={saveName}
        />
      </Card>

      {/* Profile info (read only) */}
      {(email || mobile) ? (
        <Card>
          <Label>Account info</Label>
          {email ? (
            <Row style={{ gap: 10 }}>
              <Ionicons name="mail-outline" size={16} color={colors.sub} />
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{email}</Text>
            </Row>
          ) : null}
          {mobile ? (
            <Row style={{ gap: 10 }}>
              <Ionicons name="call-outline" size={16} color={colors.sub} />
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{mobile}</Text>
            </Row>
          ) : null}
        </Card>
      ) : null}

      {/* Dining Preferences Section */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Label>Dining Preferences ({preferences.length})</Label>
        {!showPrefForm ? (
          <TouchableOpacity
            onPress={openNewPrefForm}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.accentSoft, borderRadius: 12 }}
          >
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accent }}>Add Preference</Text>
          </TouchableOpacity>
        ) : null}
      </Row>

      {prefSuccess ? (
        <Callout icon="checkmark-circle" tone="green" title="Saved" text={prefSuccess} />
      ) : null}

      {/* Add / Edit Preference Form */}
      {showPrefForm ? (
        <Card style={{ borderColor: colors.accent, borderWidth: 1.5, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H>{editingPrefId ? 'Edit Dining Preference' : 'Add Dining Preference'}</H>
            <TouchableOpacity onPress={() => setShowPrefForm(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.sub} />
            </TouchableOpacity>
          </Row>

          <Label>Category</Label>
          <Row style={{ flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setPrefCategory(cat.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: prefCategory === cat.key ? colors.ink : colors.line,
                  backgroundColor: prefCategory === cat.key ? colors.ink : '#fff',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: prefCategory === cat.key ? '#fff' : colors.ink }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Row>

          {/* Quick Preset Buttons if creating new */}
          {!editingPrefId ? (
            <View style={{ gap: 4 }}>
              <Label style={{ fontSize: 10 }}>Quick suggestions</Label>
              <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                {PRESETS.map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setPrefCategory(p.category);
                      setPrefTitle(p.title);
                    }}
                    style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: '#f0ece4' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.ink }}>+ {p.title}</Text>
                  </TouchableOpacity>
                ))}
              </Row>
            </View>
          ) : null}

          <Field
            label="Title / Requirement *"
            placeholder="e.g. Peanut Allergy, Wheelchair Ramp, Quiet Booth"
            value={prefTitle}
            onChangeText={(v) => { setPrefTitle(v); setPrefError(null); }}
            autoCapitalize="sentences"
          />

          <Field
            label="Additional Notes (Optional)"
            placeholder="e.g. Severe allergy, seat near exit for accessibility"
            value={prefNotes}
            onChangeText={setPrefNotes}
            multiline
            numberOfLines={2}
            style={{ minHeight: 64, paddingTop: 10 }}
          />

          {prefError ? (
            <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{prefError}</Text>
          ) : null}

          <Row style={{ marginTop: 4 }}>
            <Button
              title="Cancel"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => { setShowPrefForm(false); setPrefError(null); }}
            />
            <Button
              title={editingPrefId ? 'Update' : 'Save Preference'}
              variant="accent"
              loading={prefSubmitting}
              style={{ flex: 1.2 }}
              onPress={handleSavePreference}
            />
          </Row>
        </Card>
      ) : null}

      {/* Preferences List View */}
      {loadingPrefs ? (
        <Card>
          <ActivityIndicator color={colors.accent} style={{ padding: 20 }} />
        </Card>
      ) : preferences.length === 0 && !showPrefForm ? (
        <Card>
          <Empty
            icon="heart-outline"
            text="No dining preferences saved yet. Add your dietary needs, accessibility, or seating preferences to get a personalized dining experience."
          />
          <Button
            title="+ Add Your First Preference"
            variant="secondary"
            onPress={openNewPrefForm}
          />
        </Card>
      ) : (
        preferences.map((item) => (
          <Card key={item.id}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Row>
                  <Chip label={item.category.toUpperCase()} tone={getCategoryTone(item.category)} />
                </Row>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{item.title}</Text>
                {item.notes ? (
                  <Text style={{ fontSize: 13, color: colors.sub, marginTop: 2 }}>{item.notes}</Text>
                ) : null}
              </View>

              {/* Action Buttons */}
              <Row style={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => openEditPrefForm(item)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#f4efe8', alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={5}
                >
                  <Ionicons name="pencil" size={16} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletePreference(item)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={5}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.red} />
                </TouchableOpacity>
              </Row>
            </Row>
          </Card>
        ))
      )}

      {/* About Card */}
      <Card>
        <Label>About</Label>
        <H>DineFlow</H>
        <Muted>DineFlow is your ultimate dining companion. Discover top-rated local restaurants, join their live virtual queues from anywhere, and secure a table effortlessly. Skip the physical line and enjoy a seamless dining experience.</Muted>
      </Card>

      <Button title="Sign out" variant="dangerOutline" onPress={logout} />
    </Screen>
  );
}

