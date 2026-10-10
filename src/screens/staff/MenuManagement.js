// Staff Menu Management – Create, read, edit, archive/unarchive, toggle availability, and delete menu items
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen, Button, Card, Field, Label, H, Muted, Row, Chip, Empty, Callout, Stat } from '../../components/UI';
import { colors } from '../../theme';
import { useMenu } from '../../hooks';
import {
  createMenuItem,
  updateMenuItem,
  setMenuItemAvailability,
  setMenuItemArchived,
  deleteMenuItem,
  seedDemoData,
} from '../../services/db';
import { friendlyErr } from '../../utils';
import { Ionicons } from '@expo/vector-icons';

const MENU_CATEGORIES = ['Appetizers', 'Mains', 'Desserts', 'Beverages', 'Specials'];

export default function MenuManagement({ navigation }) {
  const menuItems = useMenu();

  const [selectedCat, setSelectedCat] = useState('All');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'available', 'unavailable', 'archived'
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Mains');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filtering
  const filtered = menuItems.filter((item) => {
    if (selectedCat !== 'All' && item.category !== selectedCat) return false;
    if (filterMode === 'available') return !item.isArchived && item.isAvailable;
    if (filterMode === 'unavailable') return !item.isArchived && !item.isAvailable;
    if (filterMode === 'archived') return item.isArchived;
    return true;
  });

  const activeCount = menuItems.filter((i) => !i.isArchived && i.isAvailable).length;
  const unavailableCount = menuItems.filter((i) => !i.isArchived && !i.isAvailable).length;
  const archivedCount = menuItems.filter((i) => i.isArchived).length;

  const openNewItemForm = () => {
    setEditingId(null);
    setName('');
    setCategory('Mains');
    setPrice('');
    setDescription('');
    setIsAvailable(true);
    setFormError(null);
    setShowForm(true);
  };

  const openEditItemForm = (item) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category || 'Mains');
    setPrice(String(item.price));
    setDescription(item.description || '');
    setIsAvailable(item.isAvailable !== false);
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    const cleanCat = category.trim();
    const numPrice = parseFloat(price);

    if (!cleanName) {
      setFormError('Item name is required.');
      return;
    }
    if (!cleanCat) {
      setFormError('Category is required.');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setFormError('Price must be a valid positive number (e.g. 18.50).');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingId) {
        await updateMenuItem(editingId, {
          name: cleanName,
          category: cleanCat,
          price: numPrice,
          description,
          isAvailable,
          isArchived: false,
        });
        setSuccessMsg(`"${cleanName}" updated successfully.`);
      } else {
        await createMenuItem({
          name: cleanName,
          category: cleanCat,
          price: numPrice,
          description,
          isAvailable,
        });
        setSuccessMsg(`"${cleanName}" added to the menu.`);
      }

      setShowForm(false);
      setEditingId(null);
      setName('');
      setPrice('');
      setDescription('');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e) {
      setFormError(friendlyErr(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      const next = !item.isAvailable;
      await setMenuItemAvailability(item.id, next);
      setSuccessMsg(`"${item.name}" marked as ${next ? 'Available' : 'Sold Out'}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      Alert.alert('Error', friendlyErr(e));
    }
  };

  const handleToggleArchive = async (item) => {
    const next = !item.isArchived;
    Alert.alert(
      next ? 'Archive Menu Item' : 'Restore Menu Item',
      next
        ? `Archive "${item.name}"? It will no longer appear on customer menus, but staff can unarchive it anytime.`
        : `Restore "${item.name}" back to the active menu list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Archive' : 'Restore',
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await setMenuItemArchived(item.id, next);
              setSuccessMsg(`"${item.name}" ${next ? 'archived' : 'restored'}.`);
              setTimeout(() => setSuccessMsg(null), 3000);
            } catch (e) {
              Alert.alert('Error', friendlyErr(e));
            }
          },
        },
      ]
    );
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Menu Item',
      `Permanently delete "${item.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenuItem(item.id);
              setSuccessMsg(`"${item.name}" permanently deleted.`);
              setTimeout(() => setSuccessMsg(null), 3500);
            } catch (e) {
              Alert.alert('Delete Failed', friendlyErr(e));
            }
          },
        },
      ]
    );
  };

  const seedStarterMenu = async () => {
    try {
      await seedDemoData();
      setSuccessMsg('Starter menu items created successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (e) {
      Alert.alert('Seed Failed', friendlyErr(e));
    }
  };

  return (
    <Screen
      staff
      title="Menu Management"
      subtitle="Dishes, categories, live availability & pricing"
      onBack={() => navigation.goBack()}
      right={<Chip label="STAFF PORTAL" tone="ink" />}
    >
      {/* Summary stats */}
      <Row>
        <Stat label="Total Dishes" value={menuItems.length} />
        <Stat label="Available" value={activeCount} tone="green" />
        <Stat label="Sold Out" value={unavailableCount} tone="amber" />
        <Stat label="Archived" value={archivedCount} tone="gray" />
      </Row>

      {/* Header action */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Label>Menu Items ({filtered.length})</Label>
        {!showForm ? (
          <TouchableOpacity
            onPress={openNewItemForm}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.accent, borderRadius: 12 }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Add Menu Item</Text>
          </TouchableOpacity>
        ) : null}
      </Row>

      {successMsg ? (
        <Callout icon="checkmark-circle" tone="green" title="Menu Updated" text={successMsg} />
      ) : null}

      {/* Add / Edit Form Card */}
      {showForm ? (
        <Card style={{ borderColor: colors.accent, borderWidth: 2, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H>{editingId ? `Edit "${name}"` : 'Create New Menu Item'}</H>
            <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.sub} />
            </TouchableOpacity>
          </Row>

          <Field
            label="Dish / Item Name *"
            placeholder="e.g. Pan-Roasted Chilean Sea Bass"
            value={name}
            onChangeText={(v) => { setName(v); setFormError(null); }}
            autoCapitalize="words"
          />

          <View style={{ gap: 6 }}>
            <Label>Category *</Label>
            <Row style={{ flexWrap: 'wrap', gap: 6 }}>
              {MENU_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
                    backgroundColor: category === cat ? colors.ink : '#fff',
                    borderWidth: 1.5,
                    borderColor: category === cat ? colors.ink : colors.line,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: category === cat ? '#fff' : colors.ink }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </Row>
          </View>

          <Field
            label="Price ($ USD) *"
            placeholder="e.g. 28.50"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={(v) => { setPrice(v); setFormError(null); }}
          />

          <Field
            label="Description / Ingredients (Optional)"
            placeholder="e.g. Wild-caught sea bass with saffron risotto and lemon herb emulsion"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
            style={{ minHeight: 64, paddingTop: 10 }}
          />

          <View style={{ gap: 6 }}>
            <Label>Availability Status</Label>
            <Row style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => setIsAvailable(true)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: isAvailable ? colors.green : '#fff',
                  borderWidth: 1.5,
                  borderColor: isAvailable ? colors.green : colors.line,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: isAvailable ? '#fff' : colors.green }}>In Stock / Available</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsAvailable(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: 10,
                  backgroundColor: !isAvailable ? colors.amber : '#fff',
                  borderWidth: 1.5,
                  borderColor: !isAvailable ? colors.amber : colors.line,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: !isAvailable ? '#fff' : colors.amber }}>Sold Out (86'd)</Text>
              </TouchableOpacity>
            </Row>
          </View>

          {formError ? (
            <Text style={{ color: colors.red, fontSize: 13, fontWeight: '600' }}>{formError}</Text>
          ) : null}

          <Row style={{ marginTop: 4 }}>
            <Button
              title="Cancel"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => { setShowForm(false); setFormError(null); }}
            />
            <Button
              title={editingId ? 'Save Changes' : 'Create Item'}
              variant="accent"
              loading={submitting}
              style={{ flex: 1.2 }}
              onPress={handleSave}
            />
          </Row>
        </Card>
      ) : null}

      {/* Filter Tabs: Category */}
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {['All', ...MENU_CATEGORIES].map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setSelectedCat(c)}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 14,
              backgroundColor: selectedCat === c ? colors.ink : '#fff',
              borderWidth: 1,
              borderColor: selectedCat === c ? colors.ink : colors.line,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: selectedCat === c ? '#fff' : colors.ink }}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </Row>

      {/* Status Filter: All / Available / Unavailable / Archived */}
      <Row style={{ gap: 6 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'available', label: 'Active' },
          { key: 'unavailable', label: 'Sold Out' },
          { key: 'archived', label: 'Archived' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilterMode(f.key)}
            style={{
              flex: 1,
              paddingVertical: 6,
              alignItems: 'center',
              borderRadius: 8,
              backgroundColor: filterMode === f.key ? '#e2ddd4' : '#fff',
              borderWidth: 1,
              borderColor: filterMode === f.key ? colors.ink : colors.line,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </Row>

      {/* Menu items list */}
      {menuItems.length === 0 ? (
        <Card>
          <Empty icon="restaurant-outline" text="No menu items in the database yet. Click below to initialize the Harbor Bistro starter menu." />
          <Button title="Seed Starter Menu Items" variant="accent" onPress={seedStarterMenu} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty icon="filter-outline" text="No menu items matching the selected filters." />
        </Card>
      ) : (
        filtered.map((item) => (
          <Card key={item.id} style={item.isArchived ? { opacity: 0.65, backgroundColor: '#f9f8f6' } : {}}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ flexWrap: 'wrap' }}>
                  <Chip label={item.category.toUpperCase()} tone="gray" />
                  {item.isArchived ? (
                    <Chip label="ARCHIVED" tone="ink" />
                  ) : item.isAvailable ? (
                    <Chip label="IN STOCK" tone="green" />
                  ) : (
                    <Chip label="SOLD OUT" tone="red" />
                  )}
                </Row>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, marginTop: 2 }}>{item.name}</Text>
                {item.description ? <Muted>{item.description}</Muted> : null}
              </View>

              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.accent, marginLeft: 8 }}>
                ${Number(item.price).toFixed(2)}
              </Text>
            </Row>

            {/* Action Bar */}
            <Row style={{ justifyContent: 'space-between', marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
              <Row style={{ gap: 6 }}>
                {!item.isArchived ? (
                  <TouchableOpacity
                    onPress={() => handleToggleAvailability(item)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: item.isAvailable ? colors.amberSoft : colors.greenSoft,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: item.isAvailable ? colors.amber : colors.green }}>
                      {item.isAvailable ? 'Mark Sold Out' : 'Mark Available'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => handleToggleArchive(item)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: '#eee9e0',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink }}>
                    {item.isArchived ? 'Restore' : 'Archive'}
                  </Text>
                </TouchableOpacity>
              </Row>

              <Row style={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => openEditItemForm(item)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0ece4', alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={5}
                >
                  <Ionicons name="pencil" size={15} color={colors.ink} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' }}
                  hitSlop={5}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.red} />
                </TouchableOpacity>
              </Row>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
